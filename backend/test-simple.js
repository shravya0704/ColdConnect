/**
 * Simple test for the new Google discovery system
 */

import dotenv from 'dotenv';
import { findEmailsWithHybrid } from './lib/hybridEmailFinder.js';

// Load environment variables
dotenv.config();

async function simpleTest() {
  console.log('🚀 Testing Google Discovery System Integration\n');
  
  try {
    console.log('Environment check:');
    console.log('- GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Set' : 'Not set');
    console.log('- GOOGLE_CX:', process.env.GOOGLE_CX ? 'Set' : 'Not set');
    console.log('- SNOVIO_API_KEY:', process.env.SNOVIO_API_KEY ? 'Set' : 'Not set');
    console.log();
    
    console.log('Testing hybrid email discovery for TechCorp...');
    
    const results = await findEmailsWithHybrid(
      'TechCorp',
      'techcorp.com',
      'engineering',
      {
        maxResults: 5,
        useCache: false,
        location: 'San Francisco'
      }
    );
    
    console.log('\n✅ Results:');
    console.log(`- Found: ${results.count} contacts`);
    console.log(`- Sources: ${results.sources.join(', ')}`);
    console.log(`- Verified: ${results.verified_count}`);
    console.log(`- Discovery attempts: ${results.discovery_attempts?.length || 0}`);
    
    if (results.discovery_attempts) {
      console.log('\n📋 Discovery log:');
      results.discovery_attempts.forEach((attempt, i) => {
        console.log(`  ${i + 1}. ${attempt}`);
      });
    }
    
    if (results.data.contacts.length > 0) {
      console.log('\n📧 Sample contacts:');
      results.data.contacts.slice(0, 3).forEach((contact, i) => {
        console.log(`  ${i + 1}. ${contact.email} (${contact.source}, confidence: ${contact.confidence})`);
      });
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

simpleTest();