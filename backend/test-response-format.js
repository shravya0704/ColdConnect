/**
 * Test the backend API response format for frontend improvements
 */

import freeEmailFinder from './lib/freeEmailFinder.js';

async function testBackendResponse() {
  console.log('Testing backend response format for frontend display...\n');
  
  // Test hiring role
  const hiringEmails = await freeEmailFinder.findCompanyContacts(
    'TechCorp',
    'hiring',
    { maxResults: 3 }
  );
  
  console.log('Backend response structure:');
  console.log(JSON.stringify(hiringEmails, null, 2));
  
  console.log('\nFields available for frontend:');
  if (hiringEmails.length > 0) {
    const contact = hiringEmails[0];
    console.log('- email:', contact.email);
    console.log('- type:', contact.type);
    console.log('- confidenceLevel:', contact.confidenceLevel);
    console.log('- confidenceReason:', contact.confidenceReason);
    console.log('- source:', contact.source);
    console.log('- pattern:', contact.pattern);
  }
}

testBackendResponse().catch(console.error);