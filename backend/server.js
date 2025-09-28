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
  console.log("📧 Generate email request received:", req.body);
  
  const { domain, company, location, tone, comments } = req.body;

  // Validate required fields
  if (!domain || !company || !location || !tone) {
    console.log("❌ Missing required fields");
    return res.status(400).json({ 
      error: "Missing required fields: domain, company, location, tone are required" 
    });
  }

  try {
    console.log("🤖 Calling Groq API...");
    
    // Initialize Groq client
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Create a compelling prompt for cold email generation
    const prompt = `Write a professional cold email for a ${domain} position at ${company} in ${location}. 

Requirements:
- Tone: ${tone.toLowerCase()}
- Company: ${company}
- Location: ${location}
- Role: ${domain}
${comments ? `- Additional context: ${comments}` : ''}

The email should:
1. Have a compelling subject line that stands out
2. Show genuine interest in the company and role
3. Highlight relevant experience and skills
4. Be personalized and not generic
5. Include a clear call-to-action
6. Be professional but engaging
7. Keep it concise (under 200 words)

Format your response as JSON with "subject" and "body" fields.`;

    // Call Groq API
    const completion = await client.chat.completions.create({
      model: "mixtral-8x7b-32768",
      messages: [
        { 
          role: "system", 
          content: "You are an expert cold email writer. Create compelling, personalized emails that get responses. Always respond with valid JSON containing 'subject' and 'body' fields." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const response = completion.choices[0].message.content;
    console.log("🤖 Groq response:", response);

    // Parse JSON response
    let emailData;
    try {
      emailData = JSON.parse(response);
    } catch (parseError) {
      console.log("⚠️ JSON parse failed, using fallback structure");
      emailData = {
        subject: `Exciting ${domain} Opportunity at ${company}`,
        body: response,
      };
    }

    console.log("✅ AI email generated successfully");
    res.json(emailData);
    
  } catch (err) {
    console.error("❌ Groq API error:", err.message);
    
    // Fallback to a more professional template
    res.json({
      subject: `Exciting ${domain} Opportunity at ${company}`,
      body: `Dear ${company} Team,

I hope this email finds you well. I'm reaching out to express my strong interest in the ${domain} position at ${company} in ${location}.

With my background in ${domain.toLowerCase()}, I'm excited about the opportunity to contribute to ${company}'s innovative work. ${comments ? `Specifically, ${comments.toLowerCase()}` : 'I bring relevant experience and a passion for delivering high-quality solutions.'}

I would love the opportunity to discuss how my skills and enthusiasm can add value to your team. Would you be available for a brief conversation this week?

Thank you for your time and consideration.

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

// ✅ start server
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
  console.log("📧 Email generation endpoint: http://localhost:5000/api/generate-email");
  console.log("🏥 Health check: http://localhost:5000/health");
});
