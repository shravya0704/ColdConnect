/**
 * Free Email Finder - Role-based inbox generation only (ethical mode)
 * Generates common role-based inboxes deterministically, with transparent confidence.
 * No fake names. No random people. Person-based patterns are handled elsewhere
 * only when a real name is known.
 */

import { resolveCompanyDomain } from "./utils/domain.js";

// Role-based keyword mapping for precision targeting
const ROLE_KEYWORDS = {
  hiring: ["hr", "recruitment", "talent", "careers"],
  partnership: ["bizdev", "partnerships", "alliances"],
  product: ["product", "pm", "innovation"],
  tech: ["engineering", "cto", "dev", "techlead"],
  marketing: ["marketing", "growth", "brand"]
};

// Deterministic role → inbox mapping as primary feature
const ROLE_TO_INBOXES = {
  hr: ['careers', 'recruiting', 'talent', 'hr'],
  recruiter: ['careers', 'recruiting', 'talent', 'hr'],
  hiring: ['careers', 'recruiting', 'talent', 'hr'],
  talent: ['careers', 'recruiting', 'talent', 'hr'],
  general: ['info', 'contact'],
  networking: ['info', 'contact']
};

// Department-specific patterns
const DEPARTMENT_PATTERNS = {
  engineering: ['tech', 'engineering', 'dev', 'developers'],
  product: ['product', 'pm', 'products'],
  marketing: ['marketing', 'growth', 'brand'],
  sales: ['sales', 'business', 'partnerships'],
  hr: ['hr', 'people', 'talent', 'careers'],
  general: ['contact', 'info', 'hello', 'team']
};

// Removed fake name fallbacks entirely to comply with ethical constraints

/**
 * Extract domain from company name
 * @param {string} company - Company name
 * @returns {string} - Likely domain
 */
function extractDomain(company) {
  return resolveCompanyDomain(company);
}

/**
 * Generate personal email patterns from name
 * @param {string} name - Full name
 * @param {string} domain - Company domain
 * @returns {Array} - Array of email pattern variations
 */
function generatePersonalEmailPatterns(name, domain) {
  if (!name || !domain) return [];
  
  // Sanitize name - remove dots, spaces, special characters
  const cleanName = name.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
  
  const nameParts = cleanName.split(/\s+/).filter(part => part.length > 0);
  
  if (nameParts.length < 2) return [];
  
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const firstInitial = firstName.charAt(0);
  
  // Standard email patterns
  return [
    `${firstName}.${lastName}@${domain}`,
    `${firstName}${lastName}@${domain}`,
    `${firstInitial}${lastName}@${domain}`,
    // We include only multi-part patterns here; single-name@domain is too generic
  ];
}

/**
 * Generate email addresses for a company and role
 * @param {string} company - Company name
 * @param {string} role - Target role/department
 * @param {Object} options - Generation options
 * @returns {Array} - Array of generated email objects
 */
export async function findCompanyContacts(company, role = 'recruiter', options = {}) {
  const {
    maxResults = 10,
    includeGeneral = true,
    includeDepartment = true,
    domain: domainOverride
  } = options;

  if (!company) {
    return [];
  }

  const domain = (domainOverride && String(domainOverride).toLowerCase()) || extractDomain(company);
  const emails = [];
  const seenEmails = new Set();

  // Determine role-based inboxes deterministically
  let functionalPatterns = [];
  const normalizedRole = String(role || '').toLowerCase();
  if (ROLE_TO_INBOXES[normalizedRole]) {
    functionalPatterns = [...ROLE_TO_INBOXES[normalizedRole]];
  } else {
    if (includeGeneral) functionalPatterns = [...ROLE_TO_INBOXES.general];
  }
  functionalPatterns = [...new Set(functionalPatterns)].slice(0, Math.max(2, Math.floor(maxResults)));

  // Generate functional email objects
  functionalPatterns.forEach((pattern) => {
    const email = `${pattern}@${domain}`;
    
    if (!seenEmails.has(email)) {
      seenEmails.add(email);
      
      emails.push({
        email,
        type: 'Role-based',
        confidenceLevel: 'Medium',
        confidenceReason: 'Common role-based inbox; not explicitly published',
        source: 'role-mapping',
        pattern: pattern
      });
    }
  });

  // No personal email generation here. Person-based emails are generated only
  // when a verified real name is available from a public company page.

  console.log(`[Pattern Generator] Generated ${emails.length} emails for ${company} (${role})`);
  
  return emails.slice(0, maxResults);
}

/**
 * Get role-based title for personal contacts
 */
function getRoleBasedTitle(role, name) {
  const roleTitles = {
    recruiter: 'Talent Acquisition Specialist',
    hr: 'HR Business Partner',
    hiring: 'Hiring Manager',
    sales: 'Business Development Manager',
    marketing: 'Marketing Manager',
    product: 'Product Manager',
    engineering: 'Engineering Manager',
    tech: 'Technical Lead'
  };
  
  return roleTitles[role] || 'Team Lead';
}

/**
 * Get department from role
 */
function getDepartmentFromRole(role) {
  if (['recruiter', 'hr', 'hiring', 'talent'].includes(role)) {
    return 'Human Resources';
  }
  if (['sales', 'business', 'partnerships'].includes(role)) {
    return 'Sales';
  }
  if (['engineering', 'tech', 'developer'].includes(role)) {
    return 'Engineering';
  }
  if (['product', 'pm'].includes(role)) {
    return 'Product';
  }
  if (['marketing', 'growth'].includes(role)) {
    return 'Marketing';
  }
  return 'General';
}

/**
 * Get likely title for email pattern
 */
function getPatternTitle(pattern, role) {
  const titleMappings = {
    careers: 'Careers Manager',
    jobs: 'Jobs Coordinator',
    hiring: 'Hiring Manager',
    recruitment: 'Recruitment Specialist',
    hr: 'HR Manager',
    people: 'People Operations',
    talent: 'Talent Acquisition',
    sales: 'Sales Manager',
    business: 'Business Development',
    contact: 'Contact Representative',
    info: 'Information Desk',
    hello: 'General Contact',
    support: 'Support Team',
    team: 'Team Representative'
  };

  return titleMappings[pattern] || `${pattern.charAt(0).toUpperCase() + pattern.slice(1)} Team`;
}

/**
 * Get department from pattern
 */
function getDepartmentFromPattern(pattern) {
  if (['careers', 'jobs', 'hiring', 'recruitment', 'hr', 'people', 'talent'].includes(pattern)) {
    return 'Human Resources';
  }
  if (['sales', 'business', 'partnerships'].includes(pattern)) {
    return 'Sales';
  }
  if (['tech', 'engineering', 'dev', 'developers'].includes(pattern)) {
    return 'Engineering';
  }
  if (['product', 'pm', 'products'].includes(pattern)) {
    return 'Product';
  }
  if (['marketing', 'growth', 'brand'].includes(pattern)) {
    return 'Marketing';
  }
  return 'General';
}

/**
 * Calculate confidence score for email patterns based on purpose and role mapping
 * @param {string} pattern - The email pattern (e.g., 'careers', 'sales')
 * @param {string} role - The purpose/role (e.g., 'hiring', 'partnership')
 * @returns {number} Confidence score (0.6-0.9)
 */
// Removed numeric scoring in favor of explicit confidence levels per requirement

export default { findCompanyContacts };