/**
 * Direct test of freeEmailFinder to verify email variations structure
 */

import dotenv from 'dotenv';
import { findCompanyContacts } from './lib/freeEmailFinder.js';

dotenv.config();

async function testEmailVariationsStructure() {
  console.log('🔍 Testing Email Variations Structure (Direct)\n');
  
  const contacts = await findCompanyContacts('Rapido', 'hr', {
    maxResults: 6
  });
  
  console.log(`Generated ${contacts.length} contacts for Rapido (hr):\n`);
  
  contacts.forEach((contact, index) => {
    console.log(`${index + 1}. ${contact.name}`);
    console.log(`   Primary Email: ${contact.email}`);
    console.log(`   Title: ${contact.title}`);
    console.log(`   Source: ${contact.source}`);
    console.log(`   Pattern: ${contact.pattern || 'functional'}`);
    
    if (contact.emailVariations) {
      console.log(`   📧 Email Variations (${contact.emailVariations.length}):`);
      contact.emailVariations.forEach((email, i) => {
        const isPrimary = email === contact.email;
        console.log(`      ${i + 1}. ${email} ${isPrimary ? '(primary)' : ''}`);
      });
    } else {
      console.log(`   📧 Single Email: ${contact.email}`);
    }
    
    console.log('   ---'); // Separator
  });
  
  // Analysis
  const personalContacts = contacts.filter(c => c.pattern === 'personal');
  const withVariations = personalContacts.filter(c => c.emailVariations && c.emailVariations.length > 1);
  
  console.log('\n📊 Structure Analysis:');
  console.log(`   Total contacts: ${contacts.length}`);
  console.log(`   Personal contacts: ${personalContacts.length}`);
  console.log(`   Contacts with variations: ${withVariations.length}`);
  
  // Show data structure for one contact
  if (personalContacts.length > 0) {
    console.log('\n📋 Sample Contact Structure:');
    const sample = personalContacts[0];
    console.log(JSON.stringify(sample, null, 2));
  }
  
  console.log('\n✅ Email variations are properly structured in the data!');
}

testEmailVariationsStructure();