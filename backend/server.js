import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
import { findEmailsWithHybrid } from './lib/hybridEmailFinder.js';
import { isValidCompanyDomain } from './lib/utils/domain.js';
import { authMiddleware } from './middleware/auth.js';

// 🧩 FIX EMAIL FINDER MAP ERROR
// This ensures we never call .map() on undefined when using findEmailsWithHybrid()
const safeFindEmailsWithHybrid = async (...args) => {
  try {
    const result = await findEmailsWithHybrid(...args);
    if (!result || typeof result !== 'object') {
      console.warn('[Email Finder] Expected object, got:', typeof result);
      return { success: false, data: { contacts: [] }, count: 0, sources: [], cached: false };
    }
    // Ensure data.contacts is always an array
    if (!Array.isArray(result.data?.contacts)) {
      console.warn('[Email Finder] Expected array for data.contacts, got:', typeof result.data?.contacts);
      return { ...result, data: { contacts: [] }, count: 0 };
    }
    return result;
  } catch (error) {
    console.error('[Email Finder] Safe wrapper caught error:', error);
    return { success: false, data: { contacts: [] }, count: 0, sources: [], cached: false };
  }
};


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env safely
dotenv.config({ path: path.join(__dirname, ".env") });
console.log("[DEBUG] GROQ_API_KEY from .env:", process.env.GROQ_API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("[DEBUG] GNEWS_API_KEY from .env:", process.env.GNEWS_API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("[DEBUG] ABSTRACT_API_KEY from .env:", process.env.ABSTRACT_API_KEY ? "✅ Loaded" : "❌ Missing");

const app = express();
const port = process.env.PORT || 5000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Per-user immutable domain confirmation store (in-memory)
// Keyed by Supabase user id; value: { domain, confirmedAt }
const confirmedDomains = new Map();

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

const allowedOrigins = [
  "https://coldconnect-dzpp.vercel.app", // older preview
  "https://cold-connect.vercel.app",     // current production
  "https://coldconnect.vercel.app",      // fallback variant
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // allow localhost:5173-5189
      const localhostMatch = origin.match(/^http:\/\/localhost:(\d{4,5})$/);
      if (localhostMatch) {
        const port = Number(localhostMatch[1]);
        if (port >= 5173 && port <= 5189) return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
    credentials: false,
    optionsSuccessStatus: 204,
  })
);

// ---- Domain Suggestion & Confirmation ----
// Suggest 1–3 likely official domains using Groq
app.post('/domains/suggest', authMiddleware, async (req, res) => {
  try {
    const { company, location } = req.body || {};
    if (!company || String(company).trim() === '') {
      return res.status(400).json({ success: false, error: 'Company name is required for suggestions' });
    }

    const systemPrompt = 'You propose likely official company web domains. Return transparent suggestions only.';
    const userPrompt = `Company: ${company}\nLocation (optional): ${location || 'N/A'}\n\nTask: Suggest 1–3 likely official web domains for this company.\nReturn ONLY valid JSON array of objects: [{"domain":"...","probability":0-100,"explanation":"..."}].\nRules:\n- Provide probability as an integer 0–100 representing confidence.\n- Provide a short, honest explanation (e.g., "commonly used brand domain in India").\n- Do not claim verification.\n- Use public naming conventions; avoid speculative subsidiaries.\n- Prefer domains with known MX where applicable.\n`;

    const completion = await safeGroqRequest(groq, {
      model: MODEL_GENERAL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const content = completion.choices?.[0]?.message?.content || '';
    let suggestions = [];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      const jsonStr = match ? match[0] : content;
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) suggestions = parsed;
    } catch (_) {
      suggestions = [];
    }

    // Validate and normalize suggestions
    const normalized = (Array.isArray(suggestions) ? suggestions : []).map(s => {
      const domain = String(s.domain || '').trim().toLowerCase();
      const prob = Math.max(0, Math.min(100, parseInt(s.probability || 0, 10) || 0));
      const explanation = String(s.explanation || '').trim();
      return { domain, probability: prob, explanation };
    }).filter(s => isValidCompanyDomain(s.domain));

    // Optional MX check: boost probability if MX exists
    const withMx = await Promise.all(normalized.map(async s => {
      try {
        const mxOk = await (await import('./lib/utils/domain.js')).hasMxRecords(s.domain);
        if (mxOk && s.probability < 90) return { ...s, probability: Math.min(95, s.probability + 10) };
        return s;
      } catch {
        return s;
      }
    }));

    return res.json({ success: true, data: withMx.slice(0, 3) });
  } catch (err) {
    console.error('[Domains] Suggest error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to suggest domains' });
  }
});

// Confirm selected domain as immutable app state
app.post('/domains/confirm', authMiddleware, async (req, res) => {
  try {
    const { domain, replace } = req.body || {};
    const d = String(domain || '').trim().toLowerCase();
    if (!isValidCompanyDomain(d)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid company domain (e.g., microsoft.com)' });
    }
    const existing = confirmedDomains.get(req.user?.id);
    if (existing && existing.domain !== d && !replace) {
      return res.status(409).json({ success: false, error: 'Domain already confirmed and locked. Pass replace=true to update explicitly.' });
    }
    confirmedDomains.set(req.user?.id, { domain: d, confirmedAt: Date.now() });
    return res.json({ success: true, domain: d });
  } catch (err) {
    console.error('[Domains] Confirm error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to confirm domain' });
  }
});

// Get current confirmed domain
app.get('/domains/current', authMiddleware, (req, res) => {
  const entry = confirmedDomains.get(req.user?.id);
  return res.json({ success: true, domain: entry?.domain || null });
});


// Analytics routes (Supabase) - dynamically imported after dotenv loads
(async () => {
  try {
    const { default: analyticsRouter } = await import('./routes/analytics.js');
    app.use('/api/analytics', authMiddleware, analyticsRouter);
  } catch (error) {
    console.warn('[Analytics] Failed to load analytics router:', error.message);
  }
})();

// Email tracking routes (Supabase) - dynamically imported after dotenv loads
(async () => {
  try {
    const { default: emailsRouter } = await import('./routes/emails.js');
    // Protect email tracking + analytics with auth
    app.use('/api/emails', authMiddleware, emailsRouter);
  } catch (error) {
    console.warn('[Emails] Failed to load emails router:', error.message);
  }
})();

// Google OAuth callback route for production
app.get('/auth/google/callback', (req, res) => {
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'https://coldconnect-dzpp.vercel.app';
  
  // Extract auth parameters from query
  const { access_token, refresh_token, expires_in, token_type } = req.query;
  
  // Redirect to frontend with auth parameters
  const redirectUrl = new URL(frontendUrl);
  if (access_token) redirectUrl.searchParams.set('access_token', access_token);
  if (refresh_token) redirectUrl.searchParams.set('refresh_token', refresh_token);
  if (expires_in) redirectUrl.searchParams.set('expires_in', expires_in);
  if (token_type) redirectUrl.searchParams.set('token_type', token_type);
  
  console.log(`[Auth] Redirecting to frontend: ${redirectUrl.toString()}`);
  res.redirect(redirectUrl.toString());
});

// Google OAuth initiation route
app.get('/auth/google', (req, res) => {
  const backendUrl = process.env.BACKEND_URL || 'https://coldconnect-putf.onrender.com';
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${backendUrl}/auth/google/callback`;
  
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }
  
  const googleAuthUrl = `https://accounts.google.com/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `access_type=offline&` +
    `prompt=consent`;
  
  console.log(`[Auth] Redirecting to Google OAuth: ${googleAuthUrl}`);
  res.redirect(googleAuthUrl);
});


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

// Resume parsing helper (improved with better text cleaning and extraction)
async function extractResumeText(file) {
  console.log("\n📋 === RESUME PARSING DEBUG ===");
  console.log("File received:", !!file);
  
  try {
    if (!file || !file.buffer) {
      console.log("❌ No valid resume file provided");
      return "No resume provided.";
    }

    const mime = file.mimetype || "";
    const filename = file.originalname || "";
    console.log("🔍 File details:", {
      filename,
      mimetype: mime,
      size: file.size,
      bufferLength: file.buffer?.length
    });

    let extracted = "";

    // Handle PDF files
    if (mime === "application/pdf") {
      console.log("📄 Processing PDF file...");
      try {
        const pdfParse = await import("pdf-parse");
        const parser = pdfParse.default || pdfParse;
        
        if (!Buffer.isBuffer(file.buffer)) {
          throw new Error("Invalid PDF buffer format");
        }
        
        console.log("📖 Parsing PDF with pdf-parse...");
        const data = await parser(file.buffer);
        
        if (!data) {
          console.warn("⚠️ PDF parser returned no data");
          return "Error parsing PDF resume - no data available.";
        }
        
        extracted = data.text || "";
        
        if (!extracted || extracted.trim().length === 0) {
          console.warn("⚠️ PDF parsed but no text extracted");
          return "No readable text found in resume. PDF may be image-based or corrupted.";
        }
        
        console.log(`✅ PDF extracted: ${extracted.length} characters`);
        
      } catch (pdfError) {
        console.error("❌ PDF parsing failed:", pdfError.message);
        console.error("📋 Error details:", {
          name: pdfError.name,
          code: pdfError.code,
          stack: pdfError.stack?.split('\n')[0]
        });
        
        // More specific error messages
        if (pdfError.message.includes('Invalid PDF structure')) {
          return "Error parsing PDF resume - invalid PDF format. Please ensure the file is a valid PDF.";
        } else if (pdfError.message.includes('ENOENT')) {
          return "Error parsing PDF resume - file not accessible. Please try uploading again.";
        } else {
          return "Error parsing PDF resume. Please try uploading a different PDF file.";
        }
      }
    }

    // Handle DOCX files
    else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.toLowerCase().endsWith(".docx")
    ) {
      console.log("📄 Processing DOCX file...");
      try {
        const mammoth = await import("mammoth");
        const mammothParser = mammoth.default || mammoth;
        const result = await mammothParser.extractRawText({ buffer: file.buffer });
        extracted = (result?.value || "");
        
        if (!extracted || extracted.trim().length === 0) {
          console.warn("⚠️ DOCX parsed but no text extracted");
          return "No readable text found in resume.";
        }
        
        console.log(`✅ DOCX extracted: ${extracted.length} characters`);
        
      } catch (docxError) {
        console.error("❌ DOCX parsing failed:", docxError.message);
        return "Error parsing DOCX resume.";
      }
    }

    // Handle TEXT files (txt, plain text)
    else if (
      mime === "text/plain" || 
      filename.toLowerCase().endsWith(".txt") ||
      filename.toLowerCase().endsWith(".text")
    ) {
      console.log("📄 Processing TEXT file...");
      try {
        extracted = file.buffer.toString('utf-8');
        
        if (!extracted || extracted.trim().length === 0) {
          console.warn("⚠️ Text file is empty");
          return "No readable text found in resume.";
        }
        
        console.log(`✅ TEXT extracted: ${extracted.length} characters`);
        
      } catch (textError) {
        console.error("❌ Text parsing failed:", textError.message);
        return "Error parsing text resume.";
      }
    }

    // Handle DOC files (legacy Word format)
    else if (
      mime === "application/msword" || 
      filename.toLowerCase().endsWith(".doc")
    ) {
      console.log("📄 Processing DOC file...");
      try {
        const mammoth = await import("mammoth");
        const mammothParser = mammoth.default || mammoth;
        const result = await mammothParser.extractRawText({ buffer: file.buffer });
        extracted = (result?.value || "");
        
        if (!extracted || extracted.trim().length === 0) {
          console.warn("⚠️ DOC parsed but no text extracted");
          return "No readable text found in resume.";
        }
        
        console.log(`✅ DOC extracted: ${extracted.length} characters`);
        
      } catch (docError) {
        console.error("❌ DOC parsing failed:", docError.message);
        return "Error parsing DOC resume.";
      }
    }

    // Unsupported file type
    else {
      console.warn("❌ Unsupported file type:", mime, "for file:", filename);
      return `Unsupported file type: ${mime}. Please upload PDF, DOCX, DOC, or TXT.`;
    }

    // Clean and process the text
    console.log("🧹 Cleaning extracted text...");
    const cleaned = extracted
      .replace(/\s+/g, " ")
      .replace(/•/g, "-")
      .replace(/\u0000/g, "")
      .replace(/\r\n/g, " ")
      .replace(/\n/g, " ")
      .trim();

    console.log(`📊 Cleaned text: ${cleaned.length} characters`);

    // Extract meaningful bullet points for resume highlights
    console.log("🎯 Extracting key highlights...");
    const bulletPoints = cleaned
      .split(/[.\n!?]/)
      .map(line => line.trim())
      .filter(line => {
        return line.length > 30 && line.length < 200 && !line.includes("@");
      })
      .slice(0, 8);

    console.log(`📋 Found ${bulletPoints.length} key highlights`);
    
    const result = bulletPoints.length > 0 ? bulletPoints.join(". ") : cleaned.slice(0, 1000);
    
    console.log(`✅ Final processed text: ${result.length} characters`);
    console.log("📝 Preview:", result.substring(0, 200) + "...");
    console.log("=== END RESUME PARSING DEBUG ===\n");
    
    return result;
    
  } catch (err) {
    console.error("💥 Unexpected error in resume parsing:", err.message);
    console.error("Stack:", err.stack);
    return "Error parsing resume.";
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

// News fetching removed: deterministic, resume-only email generation


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

// Email generation system prompt
const emailSystemPrompt = `You are an expert at writing personalized, professional cold outreach emails. You generate concise, engaging emails that sound human and authentic. You always return valid JSON with the exact structure requested.`;

// Simple health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// POST route to find decision makers (unified with email finder)
app.post('/find-decision-makers', authMiddleware, async (req, res) => {
  // Extract and validate fields from req.body
  const { company, location, role, seniority, maxResults, domain } = req.body;
  
  // Validation
  if (!company || company.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Company name is required' 
    });
  }

  // Domain policy: immutable if provided; otherwise require confirmed domain
  const confirmed = confirmedDomains.get(req.user?.id)?.domain || null;
  if (domain && !isValidCompanyDomain(domain)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid company domain (e.g., microsoft.com)' });
  }
  if (confirmed && domain && confirmed !== String(domain).trim().toLowerCase()) {
    return res.status(409).json({ success: false, error: 'Cross-domain mix detected. Use the confirmed domain or update it explicitly.' });
  }
  const finalDomain = (domain ? String(domain).trim().toLowerCase() : confirmed);
  if (!finalDomain) {
    return res.status(400).json({ success: false, error: 'Domain not confirmed. Please select a domain before continuing.', requires_domain_confirmation: true });
  }
  
  // Set defaults
  const searchLocation = location || 'India';
  // Strict role enum normalization
  const normalizeRole = (r) => {
    const v = String(r || '').toLowerCase();
    if (v.includes('recruit') || v === 'hr' || v.includes('human resources')) return 'hiring';
    if (v.includes('hiring')) return 'hiring';
    // Technical detection
    if (v.includes('engineer') || v.includes('developer') || v.includes('software') || v.includes('dev') || v.includes('tech')) return 'engineering';
    if (v.includes('general')) return 'general';
    return 'general';
  };
  const searchRole = normalizeRole(role);
  const limit = maxResults || 10;
  
  console.log(`[Email Finder] Finding decision makers for: ${company} (${finalDomain}) in ${searchLocation}`);
  
  try {
    // Use hybrid email finder to get company contacts
    const emailResults = await safeFindEmailsWithHybrid(company, finalDomain, searchRole, {
      maxResults: limit,
      useCache: true,
      verifyEmails: true
    });
    
    // Transform email results to match expected decision makers format
    const contacts = emailResults.data.contacts.map(entry => ({
      email: entry.email,
      type: entry.type,
      confidenceLevel: entry.confidenceLevel,
      confidenceReason: entry.confidenceReason,
      name: entry.name,
      title: entry.title,
      location: searchLocation
    }));
    
    console.log(`[Email Finder] Found ${contacts.length} contacts using hybrid approach`);
    
    // Success response matching frontend expectations
    return res.json({
      success: true,
      data: {
        contacts: contacts,
        count: contacts.length,
        source: emailResults.sources.join(', '),
        cached: emailResults.cached
      },
      meta: {
        company: company,
        location: searchLocation,
        role: searchRole,
        domain: finalDomain,
        // Removed seniority claims to avoid implying decision-maker status
      }
    });
    
  } catch (error) {
    console.log(`[Email Finder] Error: ${error.message}`);
    console.error('[Email Finder] Error finding decision makers:', error.message);
    
    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Failed to search decision makers',
      details: error.message
    });
  }
});

// POST route to find company emails using hybrid approach
app.post('/find-emails', authMiddleware, async (req, res) => {
  const { company, role, maxResults, domain, location, purpose } = req.body;
  
  if (!company || company.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Company name is required' 
    });
  }

  // Domain policy: immutable if provided; otherwise require confirmed domain
  const confirmed = confirmedDomains.get(req.user?.id)?.domain || null;
  if (domain && !isValidCompanyDomain(domain)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid company domain (e.g., microsoft.com)' });
  }
  if (confirmed && domain && confirmed !== String(domain).trim().toLowerCase()) {
    return res.status(409).json({ success: false, error: 'Cross-domain mix detected. Use the confirmed domain or update it explicitly.' });
  }
  const finalDomain = (domain ? String(domain).trim().toLowerCase() : confirmed);
  if (!finalDomain) {
    return res.status(400).json({ success: false, error: 'Domain not confirmed. Please select a domain before continuing.', requires_domain_confirmation: true });
  }

  // Ensure role is properly converted to string to prevent [object Object] logs
  let searchRole = role || 'recruiter';
  if (typeof searchRole === 'object' && searchRole !== null) {
    searchRole = Object.values(searchRole).join(' ');
  }
  // Strict role enum normalization
  const normalizeRole = (r) => {
    const v = String(r || '').toLowerCase();
    if (v.includes('recruit') || v === 'hr' || v.includes('human resources')) return 'hiring';
    if (v.includes('hiring')) return 'hiring';
    if (v.includes('engineer') || v.includes('developer') || v.includes('software') || v.includes('dev') || v.includes('tech')) return 'engineering';
    if (v.includes('general')) return 'general';
    return 'general';
  };
  searchRole = normalizeRole(searchRole);

  const limit = maxResults || 10;
  
  console.log(`[POST /find-emails] Searching for role="${searchRole}" at company="${company}" domain="${finalDomain}"`);
  
  try {
    const results = await safeFindEmailsWithHybrid(company, finalDomain, searchRole, {
      maxResults: limit,
      useCache: true,
      verifyEmails: true,
      location: location,
      purpose: purpose || 'job'
    });
    
    console.log(`[POST /find-emails] Found ${results.count} contacts`);
    
    return res.json({
      success: true,
      data: {
        contacts: results.data.contacts.map(e => ({
          email: e.email,
          type: e.type,
          confidenceLevel: e.confidenceLevel,
          confidenceReason: e.confidenceReason,
          name: e.name,
          title: e.title
        }))
      },
      meta: {
        company: company,
        domain: finalDomain,
        role: searchRole,
        location: location,
        sources: results.sources,
        cached: results.cached
      }
    });
    
  } catch (error) {
    console.log(`[POST /find-emails] Error: ${error.message}`);
    console.error('[API Error] /find-emails:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to find emails',
      details: error.message
    });
  }
});

// GET route to check API status
app.get('/api-status', (req, res) => {
  const snovioConfigured = !!process.env.SNOVIO_API_KEY;
  const abstractConfigured = !!process.env.ABSTRACT_API_KEY;
  
  res.json({
    success: true,
    apis: {
      email_finder: {
        configured: true, // Always available with pattern generation
        status: 'ready',
        sources: [
          'pattern-generation (unlimited)',
          snovioConfigured ? 'snov.io (50 emails/month)' : 'snov.io (not configured)',
          abstractConfigured ? 'abstract verification (100/month)' : 'abstract verification (not configured)'
        ],
        noBillingRequired: true
      },
      groq: {
        configured: !!process.env.GROQ_API_KEY,
        status: !!process.env.GROQ_API_KEY ? 'ready' : 'not_configured'
      },
      news: {
        configured: !!process.env.GNEWS_API_KEY,
        status: !!process.env.GNEWS_API_KEY ? 'ready' : 'not_configured'
      }
    }
  });
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
app.post("/generate-email", authMiddleware, conditionalUpload, async (req, res) => {
  try {
    const { role, company, location, tone, purpose: rawPurpose } = req.body || {};
    // Require confirmed domain before any generation
    const confirmed = confirmedDomains.get(req.user?.id)?.domain || null;
    if (!confirmed) {
      return res.status(400).json({ error: "Domain not confirmed. Please select and confirm a domain before generating email.", requires_domain_confirmation: true });
    }
    const purpose = (rawPurpose && String(rawPurpose).trim()) || "job";
    // Normalize extra comments: accept either 'comments' or 'extraComments' from the client
    const rawComments = (req.body && (req.body.comments ?? req.body.extraComments)) ?? "";
    const comments = (typeof rawComments === "string"
      ? rawComments
      : Array.isArray(rawComments)
        ? rawComments.join(" ")
        : String(rawComments || "")
    ).trim();
    console.log("[DEBUG] Received data:", { role, company, location, tone, comments, purpose, domain: confirmed });

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

    // News disabled
    const companyNews = null;

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

      // News line removed


    // Deterministic resume-derived fields
    const skills = Array.isArray(topSkills) ? topSkills.slice(0, 4) : [];
    const roleIntent = String(role || '').trim();
    const inferExperienceLevel = (text, r) => {
      const t = String(text || '').toLowerCase();
      const rr = String(r || '').toLowerCase();
      if (rr.includes('intern') || t.includes('intern')) return 'intern';
      if (t.includes('undergrad') || t.includes('undergraduate') || t.includes('student') || t.includes('b.tech') || t.includes('btech') || t.includes('bachelor')) return 'undergraduate';
      return '';
    };
    const experienceLevel = inferExperienceLevel(resumeText || '', roleIntent);

    const skillsLineDet = skills.length ? skills.join(', ') : 'N/A';
    const experiencePhrase = experienceLevel ? `I am an ${experienceLevel}. ` : '';
    const teamTemplate = () => {
      return `Hi ${company} Hiring Team,\n\nI am interested in the ${roleIntent} role. ${experiencePhrase}My core skills include ${skillsLineDet}.\n\n[Optional: add 1 line about a relevant project or past experience]\n\nI have attached my resume for your consideration. Please let me know if any additional information is needed.\n\nBest,\nShravya Azmani`;
    };
    const emailBody = teamTemplate();
    const subjectSuggestions = [
      `Application for ${roleIntent}`,
      `${roleIntent} — Resume Attached`,
      `Consideration for ${roleIntent}`
    ];

    return res.json({ emailBody, subjectSuggestions, newsSummary: [] });
  } catch (err) {
    console.error("Error in /generate-email:", err && (err.stack || err.message || err));
    // Return a graceful fallback instead of 500 to keep frontend happy
    try {
      const { role, company, location, comments, purpose } = req.body || {};
      const roleIntent = String(role || 'Opportunity').trim();
      const skillsLineDet = 'N/A';
      const emailBody = `Hi ${company || 'Hiring Team'},\n\nI am interested in the ${roleIntent} role. My core skills include ${skillsLineDet}.\n\nI have attached my resume for your consideration. Please let me know if any additional information is needed.\n\nBest,\nShravya Azmani`;
      const subjectSuggestions = [
        `Application for ${roleIntent}`,
        `${roleIntent} — Resume Attached`,
        `Consideration for ${roleIntent}`
      ];
      return res.status(200).json({ emailBody, subjectSuggestions, newsSummary: [] });
    } catch (fallbackErr) {
      console.error('[Fallback Build Error]', fallbackErr);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Suggest a single optional experience line from resume (verbatim selection)
app.post('/experience-suggestion', authMiddleware, conditionalUpload, async (req, res) => {
  try {
    // Extract resume text if provided
    const resumeText = await extractResumeText(req.file);
    const text = String(resumeText || '').trim();
    if (!text) {
      return res.json({ suggestion: '' });
    }

    // Prefer deterministic local extraction to avoid rewriting
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    const bannedBuzz = [
      'passionate', 'synergy', 'dynamic', 'impact', 'leverage', 'disrupt', 'innovative', 'revolution', 'world-class', 'cutting-edge', 'groundbreaking', 'visionary'
    ];

    const isGeneric = (s) => {
      const lower = s.toLowerCase();
      if (/\d/.test(lower)) return false; // no numbers/metrics/dates
      if (bannedBuzz.some(b => lower.includes(b))) return false;
      // avoid outcomes claims
      if (/(increased|reduced|boosted|improved|impact|resulted|grew|decreased)/i.test(lower)) return false;
      // length bounds
      const len = s.length;
      return len >= 40 && len <= 180;
    };

    let picked = sentences.find(isGeneric) || '';

    // If nothing suitable found locally, ask Groq to SELECT verbatim line (no rewrite)
    if (!picked && process.env.GROQ_API_KEY) {
      try {
        const systemPrompt = 'Select a single, verbatim sentence from the resume. Do not rewrite.';
        const userPrompt = `From the resume text below, choose ONE existing sentence verbatim that describes a relevant project or past experience.\nRules:\n- 1 sentence only, verbatim from resume (no paraphrase)\n- No metrics/numbers/dates\n- No impact/outcome claims\n- No buzzwords (synergy, disruptive, innovative, passionate, etc.)\n- If no suitable sentence exists, return an empty string.\n\nReturn JSON only: {"suggestion": string}.\n\nResume:\n${text}`;
        const completion = await safeGroqRequest(groq, {
          model: MODEL_GENERAL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0,
          max_tokens: 120,
        });
        const content = completion.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
        if (parsed && typeof parsed.suggestion === 'string') {
          picked = parsed.suggestion.trim();
        }
      } catch (err) {
        console.warn('[Experience Suggestion] Groq selection failed:', err?.message || err);
      }
    }

    // Ensure constraints again server-side
    if (picked) {
      if (/\d/.test(picked)) picked = '';
      const lower = picked.toLowerCase();
      if (/(increased|reduced|boosted|improved|impact|resulted|grew|decreased)/.test(lower)) picked = '';
      if (bannedBuzz.some(b => lower.includes(b))) picked = '';
    }

    return res.json({ suggestion: picked || '' });
  } catch (err) {
    console.error('[Experience Suggestion] Error:', err?.message || err);
    return res.json({ suggestion: '' });
  }
});

app.listen(port, () => {
  const backendUrl = process.env.BACKEND_URL || 'https://coldconnect-putf.onrender.com';
  const isProduction = process.env.NODE_ENV === 'production';
  const serverUrl = isProduction ? backendUrl : `http://localhost:${port}`;
  
  console.log(`✅ Backend running on ${serverUrl}`);
  console.log(`📧 Email generation: ${process.env.GROQ_API_KEY ? '✅ Ready' : '⚠️  Missing GROQ_API_KEY'}`);
  console.log(`🎯 Email discovery: ✅ Ready (Hybrid + ${process.env.SNOVIO_API_KEY ? 'Snov.io' : 'Pattern-only'})`);
  console.log(`📰 Company news: ${process.env.GNEWS_API_KEY ? '✅ Ready (GNews)' : '⚠️  Add GNEWS_API_KEY for news integration'}`);
  console.log(`📬 Email finder: ✅ Ready (Pattern + ${process.env.SNOVIO_API_KEY ? 'Snov.io' : 'Pattern-only'})`);
  console.log(`✉️  Email verification: ${process.env.ABSTRACT_API_KEY ? '✅ Ready (Abstract)' : '⚠️  Pattern-only mode'}`);
  
  if (process.env.GOOGLE_CLIENT_ID) {
    console.log(`🔐 Google OAuth: ✅ Ready (${backendUrl}/auth/google)`);
  } else {
    console.log(`🔐 Google OAuth: ⚠️  Missing GOOGLE_CLIENT_ID`);
  }
});
