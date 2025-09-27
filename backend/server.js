const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: __dirname + '/.env' });


const app = express();
const port = process.env.PORT || 5000;

// Debug log
if (process.env.GROQ_API_KEY) {
  console.log("✅ Groq API key loaded.");
} else {
  console.warn("⚠️  Groq API key missing! The /generate-email route will not work.");
}


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});



// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5176"], // frontend ports
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));



// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "ColdConnect backend is running" });
});

app.post("/generate-email", async (req, res) => {
  try {
    const { role, company, location, tone, comments } = req.body;

    if (!role || !company || !location || !tone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const prompt = `Write a professional cold email for a ${role} position at ${company} in ${location}, with a ${tone.toLowerCase()} tone. ${comments ? `Extra notes: ${comments}` : ""
      }`;

    // Initialize Groq
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: "mixtral-8x7b-32768", // or "llama3-70b-8192"
      messages: [
        {
          role: "system",
          content:
            "You are a professional email writing assistant. Always respond with valid JSON containing 'subject' and 'body' fields.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content;

    // Try parsing JSON, fallback to text if needed
    let data;
    try {
      data = JSON.parse(response);
    } catch {
      data = {
        subject: "Professional Inquiry",
        body: response,
      };
    }

    res.json(data);

  } catch (err) {
    console.error("❌ Groq API error, using fallback:", err);

    // Professional fallback email
    res.json({
      subject: "Application for Open Position",
      body: `Dear Hiring Manager,

I am writing to express my interest in the advertised role at your company. With relevant skills and experience, I am confident in my ability to contribute effectively.

I would be delighted to discuss how my background aligns with your team's needs. Please let me know a convenient time for us to connect.

Best regards,
[Your Name]`,
    });
  }
});


// Start server
app.listen(port, () => {
  console.log(`🚀 ColdConnect backend running at http://localhost:${port}`);
});
