console.log("🔥 THIS IS THE BACKEND SERVER.JS THAT IS RUNNING");
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5176"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use(bodyParser.json());

// Debug log for API key
if (process.env.GROQ_API_KEY) {
  console.log("✅ Groq API key loaded");
} else {
  console.warn("⚠️ Groq API key missing! Using fallback responses.");
}

// ✅ test route
app.get("/api/ping", (req, res) => {
  console.log("✅ Ping route hit");
  res.json({ message: "pong" });
});

// ✅ main generate email route
app.post("/api/generate-email", async (req, res) => {
  try {
    console.log("📧 Generate email request received:", req.body);
    
    const { domain, company, location, tone, comments } = req.body;

    // Validate required fields
    if (!domain || !company || !location || !tone) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ 
        error: "Missing required fields: domain, company, location, tone are required" 
      });
    }

    // Check if API key is configured
    if (!process.env.GROQ_API_KEY) {
      console.log("❌ No Groq API key configured, using fallback");
      return res.json({
        subject: `Application for ${domain} Position at ${company}`,
        body: `Dear Hiring Manager,

I am writing to express my interest in the ${domain} position at ${company} in ${location}. With relevant skills and experience, I am confident in my ability to contribute effectively.

I would be delighted to discuss how my background aligns with your team's needs. Please let me know a convenient time for us to connect.

Best regards,
[Your Name]`,
      });
    }

    console.log("🤖 Calling Groq API...");

    // Initialize Groq client inside the route
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Groq API call
    const completion = await client.chat.completions.create({
      model: "mixtral-8x7b-32768",
      messages: [
        { 
          role: "system", 
          content: "You are an AI that writes professional cold emails. Always respond with valid JSON containing 'subject' and 'body' fields." 
        },
        {
          role: "user",
          content: `Write a professional cold email for a ${domain} position at ${company} in ${location}, with a ${tone.toLowerCase()} tone. ${comments ? `Extra notes: ${comments}` : ""}

Please provide:
1. A compelling subject line
2. A professional email body that:
   - Introduces the candidate professionally
   - Shows knowledge of the company
   - Highlights relevant experience
   - Includes a clear call-to-action
   - Maintains the requested tone

Format your response as JSON with "subject" and "body" fields.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content;
    console.log("🤖 Groq response:", response);

    // Try to parse JSON response
    let emailData;
    try {
      emailData = JSON.parse(response);
    } catch (parseError) {
      console.log("⚠️ JSON parse failed, using fallback structure");
      emailData = {
        subject: `Application for ${domain} Position at ${company}`,
        body: response,
      };
    }

    console.log("✅ Email generated successfully");
    res.json(emailData);
    
  } catch (err) {
    console.error("❌ Error in /api/generate-email:", err);
    
    // Professional fallback email
    const { domain, company, location } = req.body || {};
    res.json({
      subject: `Application for ${domain || 'Open'} Position at ${company || 'Your Company'}`,
      body: `Dear Hiring Manager,

I am writing to express my interest in the advertised role at your company. With relevant skills and experience, I am confident in my ability to contribute effectively.

I would be delighted to discuss how my background aligns with your team's needs. Please let me know a convenient time for us to connect.

Best regards,
[Your Name]`,
    });
  }
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "ColdConnect backend is running" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// ✅ start server
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
  console.log("📧 Email generation endpoint: http://localhost:5000/api/generate-email");
  console.log("🏥 Health check: http://localhost:5000/health");
});
