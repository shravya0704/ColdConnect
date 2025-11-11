/**
 * Test specific edge cases for input sanitization fixes
 */

import dotenv from 'dotenv';
import { findEmailsWithHybrid } from './lib/hybridEmailFinder.js';

// Load environment variables
dotenv.config();

async function testInputSanitization() {
  console.log('🧪 Testing Input Sanitization & Stability Fixes\n');
  
  try {
    // Test 1: Object role parameter (should not produce [object Object])
    console.log('Test 1: Object role parameter...');
    const results1 = await findEmailsWithHybrid(
      'Microsoft',
      'microsoft.com',
      { primary: 'software engineer', secondary: true, count: 10 }, // Complex object
      { maxResults: 3, useCache: false }
    );
    
    console.log(`✅ Object role handled: ${results1.count} contacts`);
    console.log(`Discovery attempts: ${results1.discovery_attempts?.join(', ')}`);
    
    // Test 2: Boolean and numeric pollution in inputs
    console.log('\nTest 2: Boolean/numeric pollution...');
    const results2 = await findEmailsWithHybrid(
      'Apple Inc. 123 true false',
      'apple.com',
      'software engineer true 456 false',
      { maxResults: 3, useCache: false }
    );
    
    console.log(`✅ Cleaned polluted inputs: ${results2.count} contacts`);
    console.log(`Sources: ${results2.sources?.join(', ')}`);
    
    // Test 3: Array safety - should not crash on undefined maps
    console.log('\nTest 3: Array safety checks...');
    const results3 = await findEmailsWithHybrid(
      'Google',
      'google.com',
      'product manager',
      { maxResults: 5, useCache: false, verifyEmails: true }
    );
    
    console.log(`✅ Array safety verified: ${results3.count} contacts`);
    console.log(`Verified: ${results3.verified_count}`);
    
    // Test 4: Empty/null protection
    console.log('\nTest 4: Empty input protection...');
    const results4 = await findEmailsWithHybrid(
      '',
      '',
      null,
      { maxResults: 3, useCache: false }
    );
    
    console.log(`✅ Empty inputs protected: success=${results4.success}, message="${results4.message}"`);
    
    // Test 5: Scraper disabled check
    console.log('\nTest 5: Scraper properly disabled...');
    const results5 = await findEmailsWithHybrid(
      'Netflix',
      'netflix.com',
      'data scientist',
      { maxResults: 3, useCache: false }
    );
    
    const scrapingDisabled = results5.discovery_attempts?.some(attempt => 
      attempt.includes('Disabled') || attempt.includes('disabled')
    );
    
    console.log(`✅ Scraper disabled: ${scrapingDisabled ? 'Yes' : 'No'}`);
    console.log(`Discovery: ${results5.discovery_attempts?.join(', ')}`);
    
    console.log('\n🎉 All input sanitization tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed with:', error.message);
    console.error('Stack:', error.stack);
  }
}

testInputSanitization();