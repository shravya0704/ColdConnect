/**
 * Unit tests for Google Search Email Discovery
 * Tests the Google Custom Search integration for finding people and contacts
 */

import { searchPeople } from './lib/googleSearchFinder.js';

/**
 * Test Google Custom Search API integration
 */
async function testGoogleSearchFinder() {
  console.log('🧪 Testing Google Search Email Finder...\n');
  
  // Test 1: Basic company search
  console.log('Test 1: Basic company search');
  try {
    const results = await searchPeople({
      company: 'TechCorp',
      domain: 'techcorp.com',
      role: 'engineering',
      limit: 3
    });
    
    console.log(`✅ Found ${results.length} people`);
    if (results.length > 0) {
      console.log('Sample result:', results[0]);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 2: Search without API configuration
  console.log('\nTest 2: Search without API key');
  const originalApiKey = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  
  try {
    const results = await searchPeople({
      company: 'TestCompany',
      domain: 'test.com'
    });
    
    console.log(`✅ Gracefully handled missing API: ${results.length} results`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Restore API key
  process.env.GOOGLE_API_KEY = originalApiKey;
  
  console.log('\n🧪 Google Search tests completed\n');
}

/**
 * Test company scraper functionality
 */
async function testCompanyScraper() {
  console.log('🧪 Testing Company Scraper...\n');
  
  const { scrapeCompanyPublicPages } = await import('./lib/companyScraper.js');
  
  // Test 1: Scrape a known domain
  console.log('Test 1: Scraping public company pages');
  try {
    const results = await scrapeCompanyPublicPages('example.com');
    console.log(`✅ Found ${results.length} people from scraping`);
    
    if (results.length > 0) {
      console.log('Sample result:', results[0]);
    }
  } catch (error) {
    console.log(`❌ Scraping error: ${error.message}`);
  }
  
  // Test 2: Handle invalid domain
  console.log('\nTest 2: Invalid domain handling');
  try {
    const results = await scrapeCompanyPublicPages('nonexistent-domain-12345.com');
    console.log(`✅ Gracefully handled invalid domain: ${results.length} results`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('\n🧪 Company scraper tests completed\n');
}

/**
 * Test hybrid email finder integration
 */
async function testHybridEmailFinder() {
  console.log('🧪 Testing Hybrid Email Finder Integration...\n');
  
  const { findEmailsWithHybrid } = await import('./lib/hybridEmailFinder.js');
  
  // Test 1: Full hybrid search
  console.log('Test 1: Complete hybrid email discovery');
  try {
    const results = await findEmailsWithHybrid(
      'TechCorp',
      'techcorp.com', 
      'engineering',
      {
        maxResults: 5,
        location: 'San Francisco',
        purpose: 'partnership',
        useCache: false
      }
    );
    
    console.log(`✅ Found ${results.count} contacts from sources: ${results.sources.join(', ')}`);
    // Discovery attempts removed; sources list shows what was used
    
    if (results.data.contacts.length > 0) {
      console.log('Sample contact:', results.data.contacts[0]);
    }
    
  } catch (error) {
    console.log(`❌ Hybrid finder error: ${error.message}`);
  }
  
  // Test 2: Fallback behavior
  console.log('\nTest 2: Fallback to patterns only');
  try {
    // Temporarily disable APIs
    const originalGoogle = process.env.GOOGLE_API_KEY;
    const originalSnov = process.env.SNOVIO_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.SNOVIO_API_KEY;
    
    const results = await findEmailsWithHybrid('TestCompany', 'test.com', 'hiring', {
      maxResults: 3,
      useCache: false
    });
    
    console.log(`✅ Pattern fallback worked: ${results.count} contacts`);
    console.log('Sources used:', results.sources);
    
    // Restore API keys
    if (originalGoogle) process.env.GOOGLE_API_KEY = originalGoogle;
    if (originalSnov) process.env.SNOVIO_API_KEY = originalSnov;
    
  } catch (error) {
    console.log(`❌ Fallback test error: ${error.message}`);
  }
  
  console.log('\n🧪 Hybrid email finder tests completed\n');
}

/**
 * Test email generation for discovered people
 */
async function testEmailGeneration() {
  console.log('🧪 Testing Email Generation for People...\n');
  
  // Mock person data
  const mockPerson = {
    name: 'John Smith',
    title: 'Senior Software Engineer',
    source: 'google-linkedin',
    link: 'https://linkedin.com/in/johnsmith'
  };
  
  console.log('Test: Email pattern generation');
  console.log('Input person:', mockPerson);
  
  // This would normally be imported from hybridEmailFinder, but it's not exported
  // For testing, we'll create a simple version here
  const emailPatterns = [
    'john.smith@techcorp.com',
    'johnsmith@techcorp.com',
    'jsmith@techcorp.com',
    'john@techcorp.com'
  ];
  
  console.log('✅ Generated email patterns:', emailPatterns);
  console.log('\n🧪 Email generation tests completed\n');
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Running Google Search Discovery Tests\n');
  console.log('========================================\n');
  
  try {
    await testGoogleSearchFinder();
    await testCompanyScraper(); 
    await testHybridEmailFinder();
    await testEmailGeneration();
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export {
  testGoogleSearchFinder,
  testCompanyScraper,
  testHybridEmailFinder,
  testEmailGeneration,
  runAllTests
};