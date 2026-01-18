/**
 * Real-world test for improved email finder
 */

import freeEmailFinder from './lib/freeEmailFinder.js';

async function testRealWorld() {
  console.log('Testing with real-world examples...\n');
  
  // Test with Stripe (hiring)
  console.log('=== Stripe - Hiring ===');
  const stripeHiring = await freeEmailFinder.findCompanyContacts(
    'Stripe',
    'hiring',
    { maxResults: 3 }
  );
  
  stripeHiring.forEach((email, i) => {
    console.log(`${i+1}. ${email.email} [${email.confidenceLevel}] - ${email.type || 'role-based'}`);
  });
  
  // Test with Shopify (partnership)
  console.log('\n=== Shopify - Partnership ===');
  const shopifyPartnership = await freeEmailFinder.findCompanyContacts(
    'Shopify',
    'partnership',
    { maxResults: 3 }
  );
  
  shopifyPartnership.forEach((email, i) => {
    console.log(`${i+1}. ${email.email} [${email.confidenceLevel}] - ${email.type || 'role-based'}`);
  });
  
  // Test with Airbnb (tech)
  console.log('\n=== Airbnb - Tech ===');
  const airbnbTech = await freeEmailFinder.findCompanyContacts(
    'Airbnb',
    'tech',
    { maxResults: 3 }
  );
  
  airbnbTech.forEach((email, i) => {
    console.log(`${i+1}. ${email.email} [${email.confidenceLevel}] - ${email.type || 'role-based'}`);
  });
}

testRealWorld().catch(console.error);