import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
import { enrichWithHunter } from './lib/hunterClient.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env safely
dotenv.config({ path: path.join(__dirname, ".env") });
console.log("[DEBUG] GROQ_API_KEY from .env:", process.env.GROQ_API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("[DEBUG] HUNTER_API_KEY from .env:", process.env.HUNTER_API_KEY ? "✅ Loaded" : "❌ Missing");

const app = express();
const port = process.env.PORT || 5000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Stable model constants (use these to avoid retired/preview models)
const MODEL_SUMMARIZATION = "llama-3.3-70b-versatile";
const MODEL_EMAIL = "llama-3.2-70b-text";
const MODEL_GENERAL = MODEL_SUMMARIZATION;

// Safe request helper: retries with fallbackModel if the chosen model is unavailable
async function safeGroqRequest(client, options, fallbackModel) {
  try {
    console.log(`[DEBUG] Using Groq model: ${options.model}`);
    return await client.chat.completions.create(options);
  } catch (err) {
    const msg = err?.message || '';
    // If the model is not found, try a sequence of fallback models in order
    if (msg.includes('model_not_found')) {
      const fallbacks = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "gemma-7b-it"];
      for (const fb of fallbacks) {
        // skip if it's the same as the original attempted model
        if (fb === options.model) continue;
        try {
          console.warn(`[Groq] Model not found, retrying with fallback: ${fb}`);
          const newOptions = { ...options, model: fb };
          console.log(`[DEBUG] Using Groq model: ${fb}`);
          return await client.chat.completions.create(newOptions);
        } catch (innerErr) {
          // continue to next fallback
          console.warn(`[Groq] Retry with ${fb} failed:`, innerErr?.message || innerErr);
        }
      }
    }
    // If no fallback succeeded or error wasn't model_not_found, rethrow
    throw err;
  }
}

const upload = multer({ storage: multer.memoryStorage() });

// Parse JSON and URL-encoded bodies for non-multipart requests
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Conditional multer middleware: only apply when Content-Type is multipart/form-data
function conditionalUpload(req, res, next) {
  try {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.startsWith('multipart/form-data')) {
      return upload.single('resume')(req, res, next);
    }
  } catch (err) {
    console.warn('[conditionalUpload] error detecting content-type, skipping multer', err && err.message);
  }
  return next();
}

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5176", "http://localhost:5178"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  })
);


// Summarize resume text into key bullet points using Groq
async function summarizeResume(text) {
  if (!text || text.trim().length === 0) return [];
  
  try {
    const systemPrompt = `You extract the most important accomplishments and experiences from resumes.`;
    const userPrompt = `From the following resume text, extract the TOP 6 most impressive accomplishments/experiences as short bullet points. Focus on quantifiable achievements, technical skills, and relevant experience. Return ONLY a JSON array of strings.

Resume:
${text}

Output format: ["Built payment system that reduced checkout time by 30%", "Led team of 5 engineers on mobile app", ...]`;

    const completion = await safeGroqRequest(groq, {
      model: MODEL_SUMMARIZATION,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "";
    
    // Try to parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map(s => String(s).trim()).slice(0, 6);
    }
    
    return [];
  } catch (err) {
    console.error("[Resume Summarization Error]", err);
    return [];
  }
}

// Parse optional Subject: from model output.
function parseGeneratedSubject(content = "") {
  if (!content) return { subject: null, body: "" };
  // Look for a leading Subject: line (case-insensitive)
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && /^subject\s*:/i.test(lines[0].trim())) {
    const subject = lines[0].replace(/^[Ss]ubject\s*:\s*/, "").trim();
    const body = lines.slice(1).join("\n").trim();
    return { subject: subject || null, body };
  }
  return { subject: null, body: content };
}

// Resume parsing helper (buffer-only; returns up to 4000 chars)
async function extractResumeText(file) {
  try {
    if (!file || !file.buffer) {
      console.log("[DEBUG] No resume uploaded or missing buffer.");
      return "";
    }

    const mime = file.mimetype || "";
    console.log("[DEBUG] Resume file type:", mime);

    let extracted = "";

    if (mime === "application/pdf") {
      // Import pdf-parse correctly for ES modules
      const pdfParse = await import("pdf-parse");
      const parser = pdfParse.default || pdfParse;
      const data = await parser(file.buffer);
      extracted = data.text || "";
    }

    else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      (file.originalname && file.originalname.toLowerCase().endsWith(".docx"))
    ) {
      // Parse DOCX from in-memory buffer
      const mammoth = await import("mammoth");
      const mammothParser = mammoth.default || mammoth;
      const result = await mammothParser.extractRawText({ buffer: file.buffer });
      extracted = (result?.value || "");
    } else {
      // DOC (.doc) not supported by mammoth; avoid any path-based parsing
      console.warn("[WARN] Unsupported resume file type:", mime, "(only PDF and DOCX are supported)");
      return "";
    }

    // Normalize and cap length
    const text = String(extracted).replace(/\u0000/g, "").trim();
    const clipped = text.slice(0, 4000);
    console.log("[DEBUG] Resume text extracted length:", clipped.length);
    return clipped;
  } catch (err) {
    console.error("[Resume Parsing Error]", err && (err.stack || err.message || err));
    return "";
  }
}

// Heuristic extractor for top hard skills from text (fallback if LLM fails)
function extractTopSkillsHeuristic(text = "") {
  const KNOWN = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'Java', 'C++', 'C#', 'Go', 'Rust', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Git', 'Figma', 'Photoshop', 'Illustrator', 'Tableau', 'Power BI', 'Excel', 'Pandas', 'NumPy',
    'scikit-learn', 'TensorFlow', 'PyTorch', 'NLP', 'Data Analysis', 'Machine Learning', 'Deep Learning', 'GraphQL', 'REST', 'Microservices', 'Kafka', 'RabbitMQ',
    'Spark', 'Hadoop', 'SEO', 'SEM', 'Marketing', 'Salesforce', 'HubSpot', 'Product Management', 'Jira', 'Agile', 'Scrum', 'Testing', 'Jest', 'Cypress', 'Playwright',
    'Selenium', 'HTML', 'CSS', 'SASS', 'Tailwind', 'Next.js', 'Vite', 'Redux', 'MobX', 'Django', 'Flask', 'Spring Boot', '.NET', 'PHP', 'Laravel', 'Ruby', 'Rails',
    'Elixir', 'Phoenix', 'Android', 'iOS', 'Swift', 'Kotlin', 'R', 'MATLAB', 'Unity', 'Unreal', 'Blender', 'DevOps', 'SRE', 'Prometheus', 'Grafana', 'ELK', 'BigQuery',
    'Snowflake', 'Airflow', 'dbt', 'Looker', 'Business Analysis', 'Networking', 'Security', 'Penetration Testing', 'Observability'
  ];
  const counts = new Map();
  const lower = text.toLowerCase();
  for (const skill of KNOWN) {
    const idx = lower.indexOf(skill.toLowerCase());
    if (idx !== -1) {
      // crude frequency: count occurrences by splitting
      const freq = lower.split(skill.toLowerCase()).length - 1;
      counts.set(skill, freq);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return sorted.slice(0, 5);
}

// Extract top 5 hard skills with Groq, fallback to heuristic if needed
async function extractHardSkills(text) {
  if (!text || text.trim().length === 0) return [];
  try {
    const systemPrompt = `You identify concrete, resume-relevant hard skills (tools, languages, frameworks, platforms, techniques).`;
    const userPrompt = `From the following resume text, list the TOP 5 HARD SKILLS (not soft skills). Return ONLY a JSON array of strings.\n\nResume:\n${text}\n\nOutput JSON only, like: ["Python", "React", "AWS", "SQL", "Docker"]`;
    const completion = await safeGroqRequest(groq, {
      model: MODEL_GENERAL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 120,
    }, "mixtral-8x7b");
    const content = completion.choices?.[0]?.message?.content?.trim() || "";
    // try parse array in content
    const jsonStrMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonStrMatch ? jsonStrMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map(s => String(s)).slice(0, 5);
    }
    return extractTopSkillsHeuristic(text);
  } catch (err) {
    console.warn("[Skills Extraction Warning] Fallback to heuristic:", err?.message || err);
    return extractTopSkillsHeuristic(text);
  }
}

// Fetch a short recent news headline about the company
async function fetchCompanyNews(company) {
  try {
    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey || !company) return null;

    const q = encodeURIComponent(company);
    const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=3&token=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const data = await resp.json();

    const topArticle = data?.articles?.[0];
    if (!topArticle) return null;

    const title = topArticle.title || "";
    const source = topArticle.source?.name || "";
    return title ? `Recent: ${title}${source ? ` — ${source}` : ''}` : null;

  } catch (err) {
    console.warn("[Company News] Skipping due to error:", err.message);
    return null;
  }
}


// Parse JSON block from model output safely
function parseJsonFromModel(content = "") {
  try {
    // try direct
    return JSON.parse(content);
  } catch (_) {
    // try to extract fenced or inline JSON
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_) { /* ignore */ }
    }
  }
  return null;
}

// Hunter.io email finding helper (simplified and robust)
// The old findEmailsWithHunter and parseLocationInfo functions have been replaced with the new Hunter client

// Simple Hunter.io email search using the new client
async function findEmailsWithHunter(company, location = '') {
  try {
    if (!process.env.HUNTER_API_KEY || process.env.HUNTER_API_KEY === "your_hunter_io_api_key_here") {
      console.log("[DEBUG] Hunter.io API key not configured, skipping email search");
      return [];
    }

    // Extract domain from company name
    let domain = company.toLowerCase();

    if (!domain.includes('.com') && !domain.includes('.org') && !domain.includes('.net') && !domain.includes('.io')) {
      const commonDomains = {
        'google': 'google.com',
        'microsoft': 'microsoft.com',
        'apple': 'apple.com',
        'amazon': 'amazon.com',
        'meta': 'meta.com',
        'facebook': 'meta.com',
        'netflix': 'netflix.com',
        'tesla': 'tesla.com',
        'uber': 'uber.com',
        'airbnb': 'airbnb.com'
      };
      domain = commonDomains[domain] || `${domain}.com`;
    }

    console.log("[Hunter.io] Searching emails for domain:", domain);

    // Use the new Hunter client with caching
    const hunterResult = await enrichWithHunter({
      company: company,
      domain: domain,
      role: "recruiter", // Look for hiring-related contacts
      firstName: "",
      lastName: ""
    });

    if (hunterResult && hunterResult.domainSearchResults) {
      // Extract emails from domain search results
      const emails = hunterResult.domainSearchResults
        .filter(email => email.confidence > 50)
        .slice(0, 5)
        .map(email => ({
          email: email.value,
          firstName: email.first_name,
          lastName: email.last_name,
          position: email.position,
          confidence: email.confidence,
          department: email.department,
          matchType: 'hunter'
        }));

      console.log("[Hunter.io] Found", emails.length, "high-confidence emails");
      return emails;
    } else {
      console.log("[Hunter.io] No emails found or quota reached");
      return [];
    }
  } catch (err) {
    console.error("[Hunter.io Error]", err);
    return [];
  }
}

// Email generation system prompt
const emailSystemPrompt = `You are an expert at writing personalized, professional cold outreach emails. You generate concise, engaging emails that sound human and authentic. You always return valid JSON with the exact structure requested.`;

// Simple health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Build a safe fallback email body when the model fails
function buildFallbackEmail({ role, company, location, comments, resumeBulletsArray, resumeSnippet }) {
  const highlights = (resumeBulletsArray && resumeBulletsArray.length)
    ? resumeBulletsArray.map(b => `- ${b}`).join("\n")
    : (resumeSnippet ? `- ${resumeSnippet}` : "- (resume not provided)");

  const intro = `Hi ${company} team,`;
  const why = `I'm reaching out about the ${role} ${location ? `role in ${location}` : 'role'}.`;
  const body = `Here are a few quick highlights:\n${highlights}`;
  const ask = `Would you be open to a short chat to see if there's a fit?`;
  const sign = `\n\nBest,\nYour candidate`;
  const extra = comments ? `\n\nNotes: ${comments}` : '';
  return `${intro}\n\n${why}\n\n${body}\n\n${ask}${extra}${sign}`;
}

// Main route: generate email + subject suggestions
app.post("/generate-email", conditionalUpload, async (req, res) => {
  try {
    const { role, company, location, tone, comments, purpose: rawPurpose } = req.body;
    const purpose = (rawPurpose && String(rawPurpose).trim()) || "job";
    console.log("[DEBUG] Received data:", { role, company, location, tone, comments, purpose });

    // Be lenient: require only role and company to avoid unnecessary 400s
    if (!role || !company) {
      return res.status(400).json({ error: "Missing required fields: role and company are required" });
    }

    // Extract resume text safely
    let resumeText = await extractResumeText(req.file);
    console.log("[DEBUG] Resume text extracted length:", resumeText.length);

    // Summarize or take snippet
    let resumeSummary = "";
    let resumeBulletsArray = [];

    try {
      if (resumeText && resumeText.length > 0) {
        // Summarize resume before sending to Groq; returns array of bullets
        const bullets = await summarizeResume(resumeText);
        if (Array.isArray(bullets) && bullets.length > 0) {
          resumeBulletsArray = bullets.slice(0, 6);
          resumeSummary = resumeBulletsArray.join('\n');
        } else {
          // fallback snippet
          resumeSummary = resumeText.slice(0, 400);
        }
        console.log("[DEBUG] Resume summary generated:", resumeSummary);
      } else {
        resumeSummary = "No resume provided.";
      }
    } catch (err) {
      console.error("[Resume Parsing Error]", err);
      resumeSummary = "Resume parsing failed.";
    }


    // Top skills
    let topSkills = [];
    try {
      topSkills = await extractHardSkills(resumeText || "");
    } catch (err) {
      topSkills = extractTopSkillsHeuristic(resumeText || "");
    }

    // News
    const companyNews = await fetchCompanyNews(company);

    // Summarize resume into bullets array
    let resumeSnippet = "";

    if (resumeSummary && typeof resumeSummary === "string") {
      // Convert summary into bullet array (split by "- " or newline)
      resumeBulletsArray = resumeSummary
        .split(/\n+/)
        .map(l => l.replace(/^[-•\s]+/, "").trim())
        .filter(Boolean);
      resumeSnippet = resumeBulletsArray.slice(0, 2).join(" | "); // For fallback
    }

    console.log("[DEBUG] Parsed resume bullets:", resumeBulletsArray);

      // Ensure skillsLine is defined before building the prompt.
      // Reuse topSkills if available; otherwise fall back to extractedSkills or 'N/A'.
      const skillsLine = (typeof topSkills !== 'undefined' && topSkills && topSkills.length)
        ? topSkills.join(', ')
        : (typeof extractedSkills !== 'undefined' && extractedSkills && extractedSkills.length)
          ? extractedSkills.join(', ')
          : 'N/A';

      // Sanitize resume bullets: remove lines containing "here are" or that are too short
      if (Array.isArray(resumeBulletsArray) && resumeBulletsArray.length) {
        const before = resumeBulletsArray.length;
        resumeBulletsArray = resumeBulletsArray.filter(b => {
          if (!b || typeof b !== 'string') return false;
          const t = b.trim();
          if (t.length < 10) return false;
          if (t.toLowerCase().includes('here are')) return false;
          return true;
        });
        if (resumeBulletsArray.length !== before) {
          console.log('[DEBUG] Sanitized resumeBulletsArray, before:', before, 'after:', resumeBulletsArray.length);
        }
      }

      // Validate company news: only include if it mentions the company name (case-insensitive)
      let newsLine = '';
      if (companyNews && company) {
        const newsLower = String(companyNews).toLowerCase();
        const compLower = String(company).toLowerCase();
        if (newsLower.includes(compLower)) {
          newsLine = companyNews;
        } else {
          console.log('[DEBUG] Ignored irrelevant news for company:', company, 'news:', companyNews);
        }
      }


    // Build prompts
    const emailUserPrompt = `
Generate a JSON ONLY (no commentary, no markdown) with the following structure:
{
  "emailBody": string,
  "subjectSuggestions": string[],
  "newsSummary": string[]
}

### CONTEXT:
You are generating a short, personalized cold email for outreach.
Use the following structured input:

- Role: ${role}
- Company: ${company}
- Location: ${location || 'N/A'}
- Tone: ${tone || 'Friendly'}
- Purpose: ${purpose}
- Resume Summary / Highlights: ${resumeBulletsArray && resumeBulletsArray.length ? resumeBulletsArray.slice(0, 5).join(' | ') : resumeSummary}
- Key skills: ${skillsLine}
- Comments: ${comments || 'N/A'}
- Company news fetched from external API:
${newsLine || 'No recent company updates found.'}

### WRITING INSTRUCTIONS:
1. Keep the total email under 130 words.
2. Tone: ${tone || 'Friendly'}, human, concise, and professional.
3. Structure:
   - Greeting: “Hi [Company] team,”
   - Company Hook: Begin with “I recently noticed [company news headline] …” if recent news exists.
   - Value Proposition: Connect your experience and skills to the company’s domain or recent initiatives.
   - CTA: End with a short, polite ask (e.g., “Would you be open to a quick chat?”)
   - Signature: “Best, Shravya Azmani”
4. Avoid generic phrases like “I’m passionate about…” or “I believe I can contribute…”.
5. Keep paragraphs short (2–3 lines max).
6. Generate 5 subject lines:
   - First 2 creative / conversational
   - Next 3 formal / polite
7. ALSO generate a field “newsSummary”:
   - If company news exists, extract up to 3 short one-line summaries (10–15 words max each)
   - Example: “Rapido expands bike taxi service to Delhi NCR — Economic Times”
   - If no news, return an empty array.

### OUTPUT EXAMPLE:
{
  "emailBody": "Hi Rapido team,\\n\\nI recently noticed Rapido expanded its bike taxi service to Delhi NCR — really exciting! As a B.Tech student experienced in product design and ML, I recently built a gamified finance education app that boosted engagement by 40%. I’d love to bring that same analytical mindset to your product team.\\n\\nWould you be open to a quick chat?\\n\\nBest,\\nShravya Azmani",
  "subjectSuggestions": [
    "Bringing Product Thinking to Rapido",
    "Exploring Data-Driven Design at Rapido",
    "Not from IIT, but can solve problems for Rapido",
    "Exploring Collaboration with Rapido",
    "Interested in Contributing to Rapido’s Product Vision"
  ],
  "newsSummary": [
    "Rapido expands bike taxi service to Delhi NCR — Economic Times",
    "Rapido partners with Metro for last-mile logistics — Hindustan Times"
  ]
}
`;



    console.log("[Groq] Email Prompt:", emailUserPrompt.slice(0, 240) + "...");
    console.log("[DEBUG] resumeBulletsArray:", resumeBulletsArray);
    console.log("[DEBUG] skillsLine:", skillsLine);

    let emailBody = "";
    let subjectSuggestions = [];
    try {
      const completion = await safeGroqRequest(groq, {
        model: MODEL_EMAIL,
        messages: [
          { role: "system", content: emailSystemPrompt },
          { role: "user", content: emailUserPrompt }
        ],
        temperature: 0.4,
        max_tokens: 500,
      }, "mixtral-8x7b");
      const content = completion.choices?.[0]?.message?.content || "";
      const parsed = parseJsonFromModel(content);
      if (parsed && typeof parsed === 'object') {
        emailBody = String(parsed.emailBody || '').trim();
        subjectSuggestions = Array.isArray(parsed.subjectSuggestions) ? parsed.subjectSuggestions.map(s => String(s)).slice(0, 5) : [];
      } else {
        throw new Error('Model did not return valid JSON');
      }
    } catch (apiError) {
      console.error("[Groq Email Gen Error]", apiError?.message || apiError);
      // Fallbacks
      emailBody = buildFallbackEmail({ role, company, location, comments, resumeBulletsArray, resumeSnippet });
      const creative = [
        `Not from IIT, but can ship for ${company}`,
        `A quick idea ${company} might like`
      ];
      const formal = [
        `Interest in ${purpose} at ${company}`,
        `Exploring ${role} opportunity at ${company}`,
        `Quick note regarding ${purpose} at ${company}`
      ];
      subjectSuggestions = [...creative, ...formal].slice(0, 5);
    }

  return res.json({ emailBody, subjectSuggestions, newsSummary: companyNews ? [companyNews] : [] });
  } catch (err) {
    console.error("Error in /generate-email:", err && (err.stack || err.message || err));
    // Return a graceful fallback instead of 500 to keep frontend happy
    try {
      const { role, company, location, comments, purpose } = req.body || {};
      const emailBody = buildFallbackEmail({
        role: role || 'Opportunity',
        company: company || 'your company',
        location: location || '',
        comments: comments || '',
        resumeBulletsArray: [],
        resumeSnippet: ''
      });
      const creative = [
        `Not from IIT, but can ship for ${company || 'your team'}`,
        `A quick idea ${company || 'your team'} might like`
      ];
      const formal = [
        `Interest in ${purpose || 'an opportunity'} at ${company || 'your company'}`,
        `Exploring ${role || 'a role'} opportunity at ${company || 'your company'}`,
        `Quick note regarding ${purpose || 'an opportunity'} at ${company || 'your company'}`
      ];
  const subjectSuggestions = [...creative, ...formal].slice(0, 5);
  return res.status(200).json({ emailBody, subjectSuggestions, newsSummary: [] });
    } catch (fallbackErr) {
      console.error('[Fallback Build Error]', fallbackErr);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.listen(port, () => {
  console.log(`✅ Backend running on http://localhost:${port}`);
});
