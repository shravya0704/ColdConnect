import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env safely
dotenv.config({ path: path.join(__dirname, ".env") });
console.log("[DEBUG] GROQ_API_KEY from .env:", process.env.GROQ_API_KEY ? "✅ Loaded" : "❌ Missing");

const app = express();
const port = process.env.PORT || 5000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const upload = multer({ storage: multer.memoryStorage() });

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5176", "http://localhost:5178"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// Resume parsing helper (safe)
async function extractResumeText(file) {
  try {
    if (!file) {
      console.log("[DEBUG] No resume uploaded.");
      return "";
    }

    console.log("[DEBUG] Resume file type:", file.mimetype);

    if (file.mimetype === "application/pdf") {
      // Lazy-load pdf-parse only when needed
      const { default: pdfParse } = await import("pdf-parse");
      const data = await pdfParse(file.buffer);
      return data.text.slice(0, 1500);
    }

    if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value.slice(0, 1500);
    }

    console.warn("[WARN] Unsupported file type for resume:", file.mimetype);
    return "";
  } catch (err) {
    console.error("[Resume Parsing Error]", err);
    return "";
  }
}


app.post("/generate-email", upload.single("resume"), async (req, res) => {
  try {
    const { role, company, location, tone, comments } = req.body;
    console.log("[DEBUG] Received data:", { role, company, location, tone, comments });

    if (!role || !company || !location || !tone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Extract resume text safely
    const resumeText = await extractResumeText(req.file);
    console.log("[DEBUG] Resume text extracted length:", resumeText.length);

    // Build email prompt
    const prompt = `Write a professional cold email for a ${role} position at ${company} in ${location}, with a ${tone.toLowerCase()} tone.
    ${comments ? `Extra notes: ${comments}` : ""}
    ${resumeText ? `Here is a summary of the user's resume: ${resumeText}` : ""}
    Return only the email body, no explanations.`;

    console.log("[Groq] Email Prompt:", prompt.slice(0, 200) + "...");

    let aiEmail = "";
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      });
      aiEmail = completion.choices[0]?.message?.content || "";
    } catch (apiError) {
      console.error("[Groq API Error]", apiError);
      return res.status(502).json({ error: "Failed to generate email from Groq API" });
    }

    // Generate contact suggestion
    let suggestion = "Unknown";
    try {
      const suggestionPrompt = `Given this context, suggest the best person/job title to email. Examples: Hiring Manager, Recruiter. Respond with only the title.
      
      Role: ${role}
      Company: ${company}
      Location: ${location}
      Tone: ${tone}
      Extra Comments: ${comments}
      ${resumeText ? `Resume Summary: ${resumeText}` : ""}`;

      console.log("[Groq] Suggestion Prompt:", suggestionPrompt.slice(0, 200) + "...");

      const suggestionRes = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: suggestionPrompt }],
        temperature: 0.3,
        max_tokens: 50,
      });

      suggestion = suggestionRes.choices[0]?.message?.content?.trim() || "Unknown";
    } catch (err) {
      console.error("[Groq Suggestion Error]", err);
    }

    res.json({
      email: aiEmail,
      subject: `Application for ${role} at ${company}`,
      suggestion,
    });
  } catch (err) {
    console.error("Error in /generate-email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend running on http://localhost:${port}`);
});
