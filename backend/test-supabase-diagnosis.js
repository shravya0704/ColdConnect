// Test script to verify Supabase table and diagnose any issues
async function testSupabaseConnection() {
  console.log('🔍 Diagnosing Supabase emails table...\n');
  
  const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
  
  // Test 1: Check if we can read from the table (GET /api/analytics)
  try {
    console.log('1️⃣  Testing read access (GET /api/analytics)...');
    const response = await fetch(`${BASE_URL}/api/analytics`);
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      console.log('✅ Read access: SUCCESS');
      console.log('📊 Current data:', JSON.stringify(data.data, null, 2));
    } else {
      console.log('❌ Read access failed:', data);
    }
  } catch (error) {
    console.log('❌ Read test error:', error.message);
  }
  
  // Test 2: Try a simple insert
  try {
    console.log('\n2️⃣  Testing write access (POST /api/emails/add)...');
    const response = await fetch(`${BASE_URL}/api/emails/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailBody: 'Hello, this is a test email to verify our tracking system is working.',
        company: 'Test Company Ltd',
        domain: 'testcompany.com',
        purpose: 'outreach',
        tone: 'professional'
      })
    });
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      console.log('✅ Write access: SUCCESS');
      console.log('📧 Created email ID:', data.data.id);
      return data.data.id; // Return for status update test
    } else {
      console.log('⚠️  Write access issue:', response.status);
      console.log('📝 Details:', JSON.stringify(data, null, 2));
      
      if (data.details && data.details.includes('row-level security')) {
        console.log('\n💡 Suggestion: The table has RLS enabled. You may need to:');
        console.log('   - Disable RLS: ALTER TABLE emails DISABLE ROW LEVEL SECURITY;');
        console.log('   - Or adjust the RLS policy for your use case');
      }
      return null;
    }
  } catch (error) {
    console.log('❌ Write test error:', error.message);
    return null;
  }
}

// Test 3: If insert worked, test status update
async function testStatusUpdate(emailId) {
  if (!emailId) {
    console.log('\n3️⃣  Skipping status update test (no email created)');
    return;
  }
  
  try {
    console.log('\n3️⃣  Testing status update...');
    const response = await fetch(`${BASE_URL}/api/emails/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailId: emailId,
        status: 'replied'
      })
    });
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      console.log('✅ Status update: SUCCESS');
      console.log('📧 Updated email:', JSON.stringify(data.data, null, 2));
    } else {
      console.log('⚠️  Status update issue:', response.status);
      console.log('📝 Details:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Status update error:', error.message);
  }
}

// Run the tests
const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
testSupabaseConnection().then(emailId => {
  if (emailId) {
    testStatusUpdate(emailId);
  }
  console.log('\n🎉 Diagnosis complete!');
});