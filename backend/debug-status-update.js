// Test status update endpoint with detailed debugging
async function debugStatusUpdate() {
  console.log('🔍 Debugging Status Update Issue...\n');
  
  const BASE_URL = 'http://localhost:5000';
  
  // First, get an email to test with
  console.log('1️⃣  Getting test email...');
  try {
    const analyticsResponse = await fetch(`${BASE_URL}/api/analytics`);
    const analyticsData = await analyticsResponse.json();
    
    if (!analyticsResponse.ok || !analyticsData.success) {
      throw new Error('Failed to fetch analytics data');
    }
    
    const emails = analyticsData.data.recent_emails;
    console.log(`   Found ${emails.length} emails`);
    
    if (emails.length === 0) {
      console.log('❌ No emails found for testing');
      console.log('💡 Create an email first by using the Generate page');
      return;
    }
    
    const testEmail = emails[0];
    console.log(`   Test email: ID=${testEmail.id}, Company=${testEmail.company}, Status=${testEmail.status}`);
    
    // Test status update
    console.log('\n2️⃣  Testing status update...');
    const newStatus = 'replied'; // Try updating to 'replied'
    
    console.log(`   Updating email ${testEmail.id} status to: ${newStatus}`);
    
    const updateResponse = await fetch(`${BASE_URL}/api/emails/update-status`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailId: testEmail.id,
        status: newStatus
      })
    });
    
    const updateData = await updateResponse.json();
    
    console.log(`   Response status: ${updateResponse.status}`);
    console.log(`   Response headers:`, Object.fromEntries(updateResponse.headers.entries()));
    console.log(`   Response body:`, JSON.stringify(updateData, null, 2));
    
    if (updateResponse.ok && updateData.success) {
      console.log('✅ Status update successful!');
      
      // Verify the update
      console.log('\n3️⃣  Verifying update...');
      const verifyResponse = await fetch(`${BASE_URL}/api/analytics`);
      const verifyData = await verifyResponse.json();
      
      if (verifyResponse.ok && verifyData.success) {
        const updatedEmail = verifyData.data.recent_emails.find(e => e.id === testEmail.id);
        if (updatedEmail) {
          console.log(`   Email status verified: ${updatedEmail.status}`);
          if (updatedEmail.status === newStatus) {
            console.log('✅ Status update verification passed!');
          } else {
            console.log('❌ Status update verification failed - status not updated');
          }
        } else {
          console.log('❌ Email not found in verification');
        }
      } else {
        console.log('❌ Verification fetch failed');
      }
    } else {
      console.log('❌ Status update failed');
      console.log('   Error details:', updateData);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

debugStatusUpdate();