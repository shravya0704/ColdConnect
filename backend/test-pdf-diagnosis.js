/**
 * PDF Parsing Debug Tool
 * Comprehensive testing for PDF parsing issues
 */

import fs from 'fs';
import path from 'path';

async function testPdfParsing() {
  console.log("🔍 === PDF PARSING DIAGNOSIS ===\n");

  // Test 1: Check if pdf-parse is properly installed
  console.log("1️⃣ Testing pdf-parse module...");
  try {
    const pdfParse = await import("pdf-parse");
    console.log("   ✅ pdf-parse module loaded successfully");
    console.log("   📦 Module type:", typeof pdfParse);
    console.log("   📦 Default export:", typeof pdfParse.default);
  } catch (err) {
    console.log("   ❌ pdf-parse import failed:", err.message);
    console.log("   💡 Solution: npm install pdf-parse");
    return;
  }

  // Test 2: Create a test PDF buffer (minimal PDF structure)
  console.log("\n2️⃣ Creating test PDF buffer...");
  
  // Minimal valid PDF content for testing
  const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Resume Content) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`;

  const testBuffer = Buffer.from(testPdfContent);
  console.log("   ✅ Test PDF buffer created:", testBuffer.length, "bytes");

  // Test 3: Test parsing with different approaches
  console.log("\n3️⃣ Testing PDF parsing methods...");
  
  try {
    const pdfParse = await import("pdf-parse");
    const parser = pdfParse.default || pdfParse;
    
    console.log("   🔧 Attempting to parse test PDF...");
    const data = await parser(testBuffer);
    
    console.log("   📊 Parse result:", {
      hasData: !!data,
      textLength: data?.text?.length || 0,
      text: data?.text || 'NO TEXT',
      numpages: data?.numpages,
      numrender: data?.numrender,
      info: data?.info
    });
    
    if (!data) {
      console.log("   ❌ No data returned from parser");
    } else if (!data.text || data.text.trim().length === 0) {
      console.log("   ⚠️ Data returned but no text content");
    } else {
      console.log("   ✅ PDF parsed successfully with text content");
    }
    
  } catch (parseError) {
    console.log("   ❌ PDF parsing error:", parseError.message);
    console.log("   📋 Error details:", {
      name: parseError.name,
      code: parseError.code,
      stack: parseError.stack?.split('\n')[0]
    });
  }

  // Test 4: Enhanced PDF parsing function with better error handling
  console.log("\n4️⃣ Enhanced PDF parsing implementation...");
  
  async function enhancedPdfParse(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Input is not a valid Buffer");
    }
    
    console.log("   📏 Buffer size:", buffer.length);
    console.log("   📋 Buffer start:", buffer.subarray(0, 10).toString());
    
    const pdfParse = await import("pdf-parse");
    const parser = pdfParse.default || pdfParse;
    
    // Add options for better parsing
    const options = {
      max: 0, // Parse all pages
      version: 'v1.10.100', // Try specific version
      normalize: true // Normalize whitespace
    };
    
    const result = await parser(buffer, options);
    
    if (!result) {
      throw new Error("PDF parser returned null/undefined");
    }
    
    if (!result.text) {
      throw new Error("PDF parser returned data but no text property");
    }
    
    if (result.text.trim().length === 0) {
      throw new Error("PDF parsed but extracted text is empty");
    }
    
    return result;
  }

  try {
    const result = await enhancedPdfParse(testBuffer);
    console.log("   ✅ Enhanced parsing successful:", result.text?.length || 0, "characters");
  } catch (enhError) {
    console.log("   ❌ Enhanced parsing failed:", enhError.message);
  }

  // Test 5: Check if there's an existing PDF file to test with
  console.log("\n5️⃣ Testing with existing PDF files...");
  
  const possiblePdfPaths = [
    'sample-resume.pdf',
    'test.pdf',
    '../sample-resume.pdf'
  ];
  
  for (const pdfPath of possiblePdfPaths) {
    if (fs.existsSync(pdfPath)) {
      console.log(`   📁 Found PDF file: ${pdfPath}`);
      try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const result = await enhancedPdfParse(pdfBuffer);
        console.log(`   ✅ Successfully parsed ${pdfPath}:`, result.text?.length || 0, "characters");
        break;
      } catch (err) {
        console.log(`   ❌ Failed to parse ${pdfPath}:`, err.message);
      }
    }
  }

  console.log("\n🎯 === DIAGNOSIS COMPLETE ===");
  console.log("If PDF parsing is still failing, check:");
  console.log("1. pdf-parse package version and installation");
  console.log("2. PDF file format and corruption");
  console.log("3. Buffer handling in multer upload");
  console.log("4. Canvas/font dependencies for pdf-parse");
}

testPdfParsing().catch(console.error);