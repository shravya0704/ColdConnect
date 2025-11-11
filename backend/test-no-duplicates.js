/**
 * Test to verify no duplicate contacts are generated
 */

import dotenv from 'dotenv';
import { findCompanyContacts } from './lib/freeEmailFinder.js';

dotenv.config();

async function testNoDuplicates() {
  console.log('🔍 Testing for Duplicate Contact Removal\n');
  
  const emails = await findCompanyContacts('Rapido', 'recruiter', {
    maxResults: 10
  });
  
  console.log(`Generated ${emails.length} contacts for Rapido (recruiter):\n`);
  
  // Check for email duplicates
  const emailSet = new Set();
  const nameSet = new Set();
  let duplicateEmails = 0;
  let duplicateNames = 0;
  
  emails.forEach((contact, index) => {
    console.log(`${index + 1}. ${contact.name} <${contact.email}> (${contact.pattern === 'personal' ? 'personal' : 'functional'})`);
    
    // Check for duplicate emails
    if (emailSet.has(contact.email)) {
      duplicateEmails++;
      console.log(`   ⚠️  DUPLICATE EMAIL: ${contact.email}`);
    } else {
      emailSet.add(contact.email);
    }
    
    // Check for duplicate names (only for personal contacts)
    if (contact.pattern === 'personal') {
      if (nameSet.has(contact.name)) {
        duplicateNames++;
        console.log(`   ⚠️  DUPLICATE NAME: ${contact.name}`);
      } else {
        nameSet.add(contact.name);
      }
    }
  });
  
  console.log('\n📊 Duplicate Analysis:');
  console.log(`   📧 Duplicate emails found: ${duplicateEmails}`);
  console.log(`   👤 Duplicate names found: ${duplicateNames}`);
  
  const success = duplicateEmails === 0 && duplicateNames === 0;
  console.log(`\n${success ? '✅' : '❌'} Result: ${success ? 'NO DUPLICATES FOUND!' : 'DUPLICATES DETECTED!'}`);
  
  if (success) {
    console.log('\n🎯 Contact generation is now producing unique results!');
    console.log('✅ Each person has only one email address');
    console.log('✅ No duplicate names in personal contacts');
    console.log('✅ No duplicate email addresses');
  }
}

testNoDuplicates();