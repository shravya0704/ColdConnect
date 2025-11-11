/**
 * Simple PDF Import Test
 */

console.log("Testing pdf-parse import step by step...");

async function testStepByStep() {
  try {
    console.log("Step 1: Attempting dynamic import...");
    
    // Try to import without immediate execution
    const pdfParseModule = await import("pdf-parse");
    console.log("✅ Import successful");
    console.log("Module structure:", Object.keys(pdfParseModule));
    
    console.log("Step 2: Getting parser function...");
    const parser = pdfParseModule.default || pdfParseModule;
    console.log("✅ Parser function obtained:", typeof parser);
    
    // Test with a very simple buffer
    console.log("Step 3: Testing with minimal buffer...");
    const testBuffer = Buffer.from("Simple test content");
    
    // This should fail but show us the actual error
    try {
      const result = await parser(testBuffer);
      console.log("Unexpected success:", result);
    } catch (err) {
      console.log("Expected parse error:", err.message);
      console.log("This is normal - we need actual PDF data");
    }
    
  } catch (importError) {
    console.log("❌ Import failed:", importError.message);
    console.log("Full error:", importError);
  }
}

testStepByStep();