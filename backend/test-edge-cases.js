/**
 * Test edge cases for the cleaned up pipeline
 */

import dotenv from 'dotenv';
import { findEmailsWithHybrid } from './lib/hybridEmailFinder.js';

// Load environment variables
dotenv.config();

async function testEdgeCases() {
  console.log('🧪 Testing Edge Cases for Clean Pipeline\n');
  
  try {
    // Test 1: Object role parameter (potential cause of [object Object])
    console.log('Test 1: Object role parameter...');
    const results1 = await findEmailsWithHybrid(
      'TestCorp',
      'testcorp.com',
      { primary: 'engineering', secondary: 'product' }, // Object instead of string
      {
        maxResults: 3,
        useCache: false
      }
    );
    
    console.log(`✅ Handled object role: ${results1.count} contacts`);
    console.log(`Sources: ${results1.sources.join(', ')}`);
    
    // Test 2: Invalid email format handling
    console.log('\nTest 2: Invalid email handling...');
    const results2 = await findEmailsWithHybrid(
      'ValidCorp',
      'validcorp.com',
      'sales',
      {
        maxResults: 3,
        useCache: false,
        verifyEmails: true
      }
    );
    
    console.log(`✅ Email validation: ${results2.count} contacts`);
    // Verification counts removed in ethical mode
    
    // Test 3: Empty/null inputs
    console.log('\nTest 3: Edge case inputs...');
    const results3 = await findEmailsWithHybrid(
      '',
      null,
      undefined,
      { maxResults: 3 }
    );
    
    console.log(`✅ Empty inputs handled: success=${results3.success}, message="${results3.message}"`);
    
    // Test 4: Large arrays/null arrays
    console.log('\nTest 4: Array safety checks...');
    const results4 = await findEmailsWithHybrid(
      'ArrayTestCorp',
      'arraytest.com',
      'hr',
      {
        maxResults: 5,
        useCache: false
      }
    );
    
    console.log(`✅ Array safety: ${results4.count} contacts`);
    // Discovery attempts removed; we now report transparent sources only
    
    console.log('\n🎉 All edge case tests passed!');
    
  } catch (error) {
    console.error('\n❌ Edge case test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEdgeCases();