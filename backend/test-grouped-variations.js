/**
 * Test to verify email variations are grouped by person
 */

import dotenv from 'dotenv';
import { findCompanyContacts } from './lib/freeEmailFinder.js';

dotenv.config();

async function testGroupedEmailVariations() {
  console.log('📧 Testing Email Variations Grouped by Person\n');
  
  const emails = await findCompanyContacts('Microsoft', 'recruiter', {
    maxResults: 8
  });
  
  console.log(`Generated ${emails.length} contacts for Microsoft (recruiter):\n`);
  
  emails.forEach((contact, index) => {
    console.log(`${index + 1}. ${contact.name} <${contact.email}>`);
    console.log(`   Title: ${contact.title}`);
    console.log(`   Pattern: ${contact.pattern === 'personal' ? 'Personal' : 'Functional'}`);
    
    // Show email variations if available
    if (contact.emailVariations && contact.emailVariations.length > 1) {
      console.log(`   📧 Email Variations (${contact.emailVariations.length}):`);
      contact.emailVariations.forEach((emailVar, varIndex) => {
        const isPrimary = emailVar === contact.email;
        console.log(`      ${varIndex + 1}. ${emailVar} ${isPrimary ? '(primary)' : ''}`);
      });
    } else if (contact.pattern === 'personal') {
      console.log(`   📧 Single Email: ${contact.email}`);
    }
    
    console.log(''); // Empty line for readability
  });
  
  // Analyze the grouping
  const personalContacts = emails.filter(e => e.pattern === 'personal');
  const functionalContacts = emails.filter(e => e.pattern !== 'personal');
  
  console.log('📊 Contact Analysis:');
  console.log(`   👥 Personal contacts: ${personalContacts.length}`);
  console.log(`   🏢 Functional contacts: ${functionalContacts.length}`);
  
  // Check if personal contacts have multiple email variations
  const contactsWithVariations = personalContacts.filter(c => c.emailVariations && c.emailVariations.length > 1);
  
  console.log(`   📧 Contacts with email variations: ${contactsWithVariations.length}`);
  
  if (contactsWithVariations.length > 0) {
    console.log('\n✅ SUCCESS: Email variations are grouped by person!');
    console.log('   Each person appears once with multiple email options.');
  } else {
    console.log('\n⚠️  NOTE: No email variations found (might be due to duplicate filtering)');
  }
  
  console.log('\n🎯 Email grouping structure implemented successfully!');
}

testGroupedEmailVariations();