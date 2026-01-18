/**
 * Test with a real company domain
 */

import dotenv from 'dotenv';
import { findEmailsWithHybrid } from './lib/hybridEmailFinder.js';

// Load environment variables
dotenv.config();

async function testRealDomain() {
  console.log('🚀 Testing with real company domain\n');
  
  try {
    console.log('Testing hybrid email discovery for Shopify...');
    
    const results = await findEmailsWithHybrid(
      'Shopify',
      'shopify.com',
      'partnerships',
      {
        maxResults: 5,
        useCache: false,
        location: 'Ottawa'
      }
    );
    
    console.log('\n✅ Results:');
    console.log(`- Found: ${results.count} contacts`);
    console.log(`- Sources: ${results.sources.join(', ')}`);
    // Verification counts removed in ethical mode
    
    // Discovery log removed; only sources are reported
    
    if (results.data.contacts.length > 0) {
      console.log('\n📧 Sample contacts:');
      results.data.contacts.slice(0, 3).forEach((contact, i) => {
        console.log(`  ${i + 1}. ${contact.email} (${contact.source}, confidence: ${contact.confidenceLevel})`);
        if (contact.name !== 'Unknown') {
          console.log(`      Name: ${contact.name}`);
        }
        if (contact.role && contact.role !== 'Unknown Position') {
          console.log(`      Role: ${contact.role}`);
        }
      });
    }
    
    console.log('\n🎉 Real domain test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testRealDomain();