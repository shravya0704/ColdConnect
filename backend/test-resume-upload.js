/**
 * Comprehensive Resume Parsing Test & Debug Tool
 * This will help diagnose and fix all resume parsing issues
 */

import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: path.join(__dirname, ".env") });

// Enhanced resume parsing function (improved version)
async function extractResumeTextEnhanced(file) {
  console.log("\n📋 === RESUME PARSING DEBUG ===");
  console.log("File received:", !!file);
  
  if (!file) {
    console.log("❌ No file provided");
    return "No resume provided.";
  }
  
  console.log("File details:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    hasBuffer: !!file.buffer,
    bufferLength: file.buffer?.length
  });

  try {
    if (!file.buffer) {
      console.log("❌ No buffer in file object");
      return "No file buffer found.";
    }

    const mime = file.mimetype || "";
    console.log("🔍 Detected MIME type:", mime);

    let extracted = "";

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
        extracted = data.text || "";
        
        console.log("✅ PDF parsed successfully");
        console.log("📊 Raw text length:", extracted.length);
        console.log("📝 First 200 chars:", extracted.substring(0, 200));
        
        if (!extracted || extracted.trim().length === 0) {
          console.log("⚠️ PDF parsed but no text extracted");
          return "No readable text found in resume.";
        }
        
      } catch (pdfError) {
        console.log("❌ PDF parsing failed:", pdfError.message);
        console.log("Stack:", pdfError.stack);
        return "Error parsing PDF resume.";
      }
    }
    
    else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      (file.originalname && file.originalname.toLowerCase().endsWith(".docx"))
    ) {
      console.log("📄 Processing DOCX file...");
      try {
        const mammoth = await import("mammoth");
        const mammothParser = mammoth.default || mammoth;
        
        console.log("📖 Parsing DOCX with mammoth...");
        const result = await mammothParser.extractRawText({ buffer: file.buffer });
        extracted = result?.value || "";
        
        console.log("✅ DOCX parsed successfully");
        console.log("📊 Raw text length:", extracted.length);
        console.log("📝 First 200 chars:", extracted.substring(0, 200));
        
        if (!extracted || extracted.trim().length === 0) {
          console.log("⚠️ DOCX parsed but no text extracted");
          return "No readable text found in resume.";
        }
        
      } catch (docxError) {
        console.log("❌ DOCX parsing failed:", docxError.message);
        return "Error parsing DOCX resume.";
      }
    } else {
      console.log("❌ Unsupported file type:", mime);
      return `Unsupported file type: ${mime}. Please upload PDF or DOCX.`;
    }

    // Clean and process the text
    console.log("🧹 Cleaning extracted text...");
    const cleaned = extracted
      .replace(/\s+/g, " ")
      .replace(/•/g, "-")
      .replace(/\u0000/g, "")
      .trim();

    console.log("📊 Cleaned text length:", cleaned.length);

    // Extract meaningful bullet points
    console.log("🎯 Extracting bullet points...");
    const bulletPoints = cleaned
      .split(/[.\n]/)
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 30 && trimmed.length < 200;
      })
      .slice(0, 8);

    console.log("📋 Found bullet points:", bulletPoints.length);
    bulletPoints.forEach((bullet, i) => {
      console.log(`   ${i + 1}. ${bullet.substring(0, 100)}...`);
    });

    const result = bulletPoints.length > 0 ? bulletPoints.join(". ") : cleaned.slice(0, 1000);
    
    console.log("✅ Final processed text length:", result.length);
    console.log("📝 Final result preview:", result.substring(0, 300));
    console.log("=== END RESUME PARSING DEBUG ===\n");
    
    return result;
    
  } catch (err) {
    console.log("💥 Unexpected error in resume parsing:", err.message);
    console.log("Stack:", err.stack);
    return "Error parsing resume.";
  }
}

// Test endpoint for debugging resume parsing
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

app.post("/test-resume", upload.single('resume'), async (req, res) => {
  console.log("\n🧪 === RESUME UPLOAD TEST ===");
  console.log("Body data:", req.body);
  console.log("File data:", !!req.file ? 'FILE RECEIVED' : 'NO FILE');
  
  try {
    const resumeText = await extractResumeTextEnhanced(req.file);
    
    res.json({
      success: true,
      resumeReceived: !!req.file,
      resumeText,
      textLength: resumeText.length,
      preview: resumeText.substring(0, 500)
    });
    
  } catch (error) {
    console.log("❌ Test endpoint error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      resumeReceived: !!req.file
    });
  }
});

// Test with sample resume file
async function testWithSampleResume() {
  try {
    console.log("🧪 Testing with sample-resume.txt...");
    
    // Create a mock file object like multer would create
    const sampleContent = fs.readFileSync('sample-resume.txt');
    const mockFile = {
      fieldname: 'resume',
      originalname: 'sample-resume.txt',
      mimetype: 'text/plain',
      size: sampleContent.length,
      buffer: sampleContent
    };
    
    const result = await extractResumeTextEnhanced(mockFile);
    console.log("\n📋 Sample Resume Test Result:");
    console.log("Length:", result.length);
    console.log("Preview:", result.substring(0, 500));
    
  } catch (error) {
    console.log("❌ Sample resume test failed:", error.message);
  }
}

const port = 5001;
app.listen(port, () => {
  console.log(`🔧 Resume parsing test server running on http://localhost:${port}`);
  console.log("📤 Test with: curl -X POST -F 'resume=@path/to/resume.pdf' http://localhost:5001/test-resume");
  
  // Auto-test with sample resume
  setTimeout(testWithSampleResume, 1000);
});

export default { extractResumeTextEnhanced };