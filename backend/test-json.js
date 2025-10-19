// Simple JSON test
async function testJsonRequest() {
  try {
    console.log('Testing JSON request...');
    
    const response = await fetch('http://localhost:5000/generate-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'Software Engineer',
        company: 'TechCorp',
        location: 'San Francisco'
      })
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success! Email body:', data.emailBody.substring(0, 100) + '...');
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testJsonRequest();