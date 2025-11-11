/**
 * Test script for improved email finder
 */

import freeEmailFinder from './lib/freeEmailFinder.js';

async function testImprovedFinder() {
  console.log('Testing improved email finder with role-based mapping...\n');
  
  // Test 1: Hiring role
  console.log('=== Test 1: Hiring Role ===');
  const hiringEmails = await freeEmailFinder.findCompanyContacts(
    'TechCorp',
    'hiring',
    { maxResults: 5 }
  );
  
  console.log('Hiring emails:');
  hiringEmails.forEach((email, i) => {
    console.log(`${i+1}. ${email.email} (confidence: ${email.confidence})`);
  });
  
  // Test 2: Partnership role  
  console.log('\n=== Test 2: Partnership Role ===');
  const partnershipEmails = await freeEmailFinder.findCompanyContacts(
    'TechCorp',
    'partnership',
    { maxResults: 5 }
  );
  
  console.log('Partnership emails:');
  partnershipEmails.forEach((email, i) => {
    console.log(`${i+1}. ${email.email} (confidence: ${email.confidence})`);
  });
  
  // Test 3: General (no role)
  console.log('\n=== Test 3: General (No Role) ===');
  const generalEmails = await freeEmailFinder.findCompanyContacts(
    'TechCorp',
    '',
    { maxResults: 5 }
  );
  
  console.log('General emails:');
  generalEmails.forEach((email, i) => {
    console.log(`${i+1}. ${email.email} (confidence: ${email.confidence})`);
  });
}

testImprovedFinder().catch(console.error);