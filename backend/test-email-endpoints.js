// Test script for email tracking endpoints
async function testEmailEndpoints() {
  console.log('🧪 Testing Email Tracking Endpoints...\n');
  
  const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
  let emailId = null;
  
  // Test 1: POST /api/emails/add
  try {
    console.log('1️⃣  Testing POST /api/emails/add...');
    const addResponse = await fetch(`${BASE_URL}/api/emails/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailBody: 'Dear John, I hope this email finds you well...',
        company: 'TechCorp Inc',
        domain: 'techcorp.com',
        purpose: 'follow_up',
        tone: 'professional'
      })
    });
    const addData = await addResponse.json();
    console.log('✅ Add email:', addResponse.status);
    console.log('📝 Response:', JSON.stringify(addData, null, 2));
    
    if (addData.success && addData.data && addData.data.id) {
      emailId = addData.data.id;
      console.log('📧 Email ID saved for next test:', emailId);
    }
  } catch (error) {
    console.log('❌ Add email failed:', error.message);
  }
  
  // Test 2: POST /api/emails/update-status (only if we have an email ID)
  if (emailId) {
    try {
      console.log('\n2️⃣  Testing POST /api/emails/update-status...');
      const updateResponse = await fetch(`${BASE_URL}/api/emails/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: emailId,
          status: 'replied'
        })
      });
      const updateData = await updateResponse.json();
      console.log('✅ Update status:', updateResponse.status);
      console.log('📝 Response:', JSON.stringify(updateData, null, 2));
    } catch (error) {
      console.log('❌ Update status failed:', error.message);
    }
  } else {
    console.log('\n2️⃣  Skipping update-status test (no email ID from previous test)');
  }
  
  // Test 3: GET /api/analytics
  try {
    console.log('\n3️⃣  Testing GET /api/analytics...');
    const analyticsResponse = await fetch(`${BASE_URL}/api/analytics`);
    const analyticsData = await analyticsResponse.json();
    console.log('✅ Get analytics:', analyticsResponse.status);
    console.log('📊 Response:', JSON.stringify(analyticsData, null, 2));
  } catch (error) {
    console.log('❌ Get analytics failed:', error.message);
  }
  
  // Test 4: Error handling - invalid status
  try {
    console.log('\n4️⃣  Testing error handling (invalid status)...');
    const errorResponse = await fetch(`${BASE_URL}/api/emails/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailId: 999,
        status: 'invalid_status'
      })
    });
    const errorData = await errorResponse.json();
    console.log('✅ Error handling:', errorResponse.status);
    console.log('🚫 Response:', JSON.stringify(errorData, null, 2));
  } catch (error) {
    console.log('❌ Error test failed:', error.message);
  }
  
  console.log('\n🎉 Email tracking endpoints test complete!');
}

testEmailEndpoints();