// Quick test script to verify analytics endpoints
async function testEndpoints() {
  console.log('🧪 Testing ColdConnect server endpoints...\n');
  
  const BASE_URL = 'http://localhost:5000';
  
  // Test 1: Health check
  try {
    console.log('1️⃣  Testing health endpoint...');
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.text();
    console.log('✅ Health:', response.status, data);
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.message);
    console.log('🔍 Make sure the server is running on port 5000');
    return;
  }
  
  // Test 2: Analytics summary (GET)
  try {
    console.log('\n2️⃣  Testing analytics summary...');
    const response = await fetch(`${BASE_URL}/api/analytics/summary`);
    const data = await response.json();
    console.log('✅ Analytics summary:', response.status);
    console.log('📊 Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('⚠️  Analytics summary:', error.message, '(expected if Supabase not configured)');
  }
  
  // Test 3: Analytics log (POST)
  try {
    console.log('\n3️⃣  Testing analytics logging...');
    const response = await fetch(`${BASE_URL}/api/analytics/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'test_event',
        tone: 'professional',
        purpose: 'test',
        company: 'Test Company'
      })
    });
    const data = await response.json();
    console.log('✅ Analytics log:', response.status);
    console.log('📝 Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('⚠️  Analytics logging:', error.message, '(expected if Supabase not configured)');
  }
  
  console.log('\n🎉 Test complete!');
}

testEndpoints();