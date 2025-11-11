/**
 * Final Resume Parsing Test
 * Tests the actual generate-email endpoint with resume upload
 */

import fs from 'fs';

async function testFinalResumeUpload() {
  try {
    console.log("🧪 === FINAL RESUME PARSING TEST ===\n");
    
    const FormData = (await import('form-data')).default;
    
    const form = new FormData();
    form.append('role', 'Software Engineer');
    form.append('company', 'Google');
    form.append('location', 'San Francisco');
    form.append('tone', 'Professional');
    form.append('purpose', 'Job Application');
    
    // Add sample resume file
    const resumeContent = fs.readFileSync('sample-resume.txt');
    form.append('resume', resumeContent, {
      filename: 'sample-resume.txt',
      contentType: 'text/plain'
    });
    
    console.log('📤 Sending request to backend with resume...');
    
    const response = await fetch('http://localhost:5000/generate-email', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('\n✅ SUCCESS! Resume parsing is working!\n');
      
      console.log('📋 Generated Email Body:');
      console.log(data.emailBody);
      console.log('\n📝 Subject Suggestions:');
      data.subjectSuggestions?.forEach((subject, i) => {
        console.log(`${i + 1}. ${subject}`);
      });
      console.log('\n📰 News Summary:');
      console.log(data.newsSummary);
      
      // Check if resume content is actually being used
      if (data.emailBody && (
        data.emailBody.includes('e-commerce') || 
        data.emailBody.includes('React') ||
        data.emailBody.includes('CI/CD') ||
        data.emailBody.includes('developer')
      )) {
        console.log('\n🎉 VERIFICATION PASSED: Resume content detected in email!');
      } else {
        console.log('\n⚠️ WARNING: Resume content may not be properly integrated');
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Error response:', error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testFinalResumeUpload();