const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const OpenAI = require('openai');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ColdConnect backend is running' });
});

// Generate email route
app.post('/generate-email', async (req, res) => {
  try {
    const { role, company, location, tone, comments } = req.body;

    // Validate required fields
    if (!role || !company || !location || !tone) {
      return res.status(400).json({
        error: 'Missing required fields: role, company, location, tone are required'
      });
    }

    // Create the prompt for OpenAI
    const prompt = `Write a professional cold email for a ${role} position at ${company} in ${location}, with a ${tone.toLowerCase()} tone. ${comments ? `Extra notes: ${comments}.` : ''} 

Please provide:
1. A compelling subject line
2. A professional email body that:
   - Introduces the candidate professionally
   - Shows knowledge of the company
   - Highlights relevant experience
   - Includes a clear call-to-action
   - Maintains the requested tone

Format your response as JSON with "subject" and "body" fields.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional email writing assistant. Always respond with valid JSON containing 'subject' and 'body' fields."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content;
    
    // Try to parse the JSON response
    let emailData;
    try {
      emailData = JSON.parse(response);
    } catch (parseError) {
      // If JSON parsing fails, create a structured response
      const lines = response.split('\n');
      const subject = lines.find(line => line.toLowerCase().includes('subject')) || 'Professional Inquiry';
      const body = response.replace(subject, '').trim();
      
      emailData = {
        subject: subject.replace(/subject:?/i, '').trim(),
        body: body
      };
    }

    res.json({
      subject: emailData.subject || 'Professional Inquiry',
      body: emailData.body || response
    });

  } catch (error) {
    console.error('Error generating email:', error);
    
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({
        error: 'OpenAI API quota exceeded. Please check your API key and billing.'
      });
    }
    
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({
        error: 'Invalid OpenAI API key. Please check your .env file.'
      });
    }

    res.status(500).json({
      error: 'Failed to generate email. Please try again.'
    });
  }
});

// File upload route (for future resume/project uploads)
app.post('/upload', upload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const fileInfo = req.files.map(file => ({
      name: file.originalname,
      size: file.size,
      type: file.mimetype
    }));

    res.json({
      message: 'Files uploaded successfully',
      files: fileInfo
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 ColdConnect backend running on port ${port}`);
  console.log(`📧 Email generation endpoint: http://localhost:${port}/generate-email`);
  console.log(`📁 File upload endpoint: http://localhost:${port}/upload`);
});

module.exports = app;
