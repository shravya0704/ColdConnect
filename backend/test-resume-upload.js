import fs from 'fs';

async function testResumeUpload() {
  try {
    const FormData = (await import('form-data')).default;
    
    const form = new FormData();
    form.append('role', 'Software Engineer');
    form.append('company', 'TechCorp');
    form.append('location', 'San Francisco');
    
    // Add sample resume file
    const resumeContent = fs.readFileSync('sample-resume.txt');
    form.append('resume', resumeContent, {
      filename: 'sample-resume.txt',
      contentType: 'text/plain'
    });
    
    console.log('Sending multipart request with resume...');
    
    const response = await fetch('http://localhost:5000/generate-email', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\nEmail Body:');
      console.log(data.emailBody);
      console.log('\nSubject Suggestions:');
      data.subjectSuggestions?.forEach((subject, i) => {
        console.log(`${i + 1}. ${subject}`);
      });
      console.log('\nNews Summary:');
      console.log(data.newsSummary);
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testResumeUpload();