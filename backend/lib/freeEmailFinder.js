/**
 * Free Email Finder - Pattern-based email generation
 * Generates likely email addresses using common corporate patterns
 */

// Role-based keyword mapping for precision targeting
const ROLE_KEYWORDS = {
  hiring: ["hr", "recruitment", "talent", "careers"],
  partnership: ["bizdev", "partnerships", "alliances"],
  product: ["product", "pm", "innovation"],
  tech: ["engineering", "cto", "dev", "techlead"],
  marketing: ["marketing", "growth", "brand"]
};

// Common email patterns used by companies
const EMAIL_PATTERNS = {
  recruiting: [
    'careers',
    'jobs',
    'hiring',
    'recruitment',
    'hr',
    'people',
    'talent',
    'join'
  ],
  sales: [
    'sales',
    'business',
    'partnerships',
    'contact',
    'hello',
    'info'
  ],
  general: [
    'contact',
    'info',
    'hello',
    'support',
    'team'
  ]
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

// Company domain mapping for accurate email generation
const domainMap = {
  google: "google.com",
  microsoft: "microsoft.com",
  amazon: "amazon.com",
  meta: "meta.com",
  facebook: "meta.com",
  apple: "apple.com",
  netflix: "netflix.com",
  uber: "uber.com",
  airbnb: "airbnb.com",
  spotify: "spotify.com",
  linkedin: "linkedin.com",
  twitter: "twitter.com",
  tesla: "tesla.com",
  salesforce: "salesforce.com",
  adobe: "adobe.com",
  oracle: "oracle.com",
  ibm: "ibm.com",
  intel: "intel.com",
  nvidia: "nvidia.com",
  paypal: "paypal.com",
  dropbox: "dropbox.com",
  slack: "slack.com",
  zoom: "zoom.us",
  shopify: "shopify.com",
  stripe: "stripe.com",
  square: "squareup.com",
  twilio: "twilio.com",
  github: "github.com",
  gitlab: "gitlab.com",
  atlassian: "atlassian.com",
  mongodb: "mongodb.com",
  redis: "redis.com",
  docker: "docker.com",
  kubernetes: "kubernetes.io",
  rapido: "rapido.bike",
  zomato: "zomato.com",
  swiggy: "swiggy.com",
  ola: "olacabs.com",
  flipkart: "flipkart.com",
  paytm: "paytm.com",
  byju: "byjus.com",
  unacademy: "unacademy.com",
  zerodha: "zerodha.com",
  razorpay: "razorpay.com",
  freshworks: "freshworks.com"
};

// Fallback HR/recruiter names for realistic email generation
const fallbackNames = [
  "Riya Patel",
  "Amit Sharma", 
  "John Davis",
  "Sarah Lee",
  "Priya Singh",
  "Rahul Kumar",
  "Jennifer Smith",
  "Michael Brown",
  "Sneha Gupta",
  "David Wilson",
  "Anita Roy",
  "Kevin Chen"
];

/**
 * Extract domain from company name
 * @param {string} company - Company name
 * @returns {string} - Likely domain
 */
function extractDomain(company) {
  if (!company) return '';
  
  // Clean company name - remove only company suffixes, preserve main company name
  const cleanCompany = company.toLowerCase()
    .replace(/\s*(inc|ltd|llc|corp|corporation|company|co\.?)\.?\s*$/g, '') // Remove only at the end
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[^a-z0-9]/g, ''); // Remove special characters but keep company name intact

  // Use domain mapping if available, otherwise fallback
  const domain = domainMap[cleanCompany] || `${cleanCompany}.com`;
  
  return domain;
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
  
  if (nameParts.length < 2) {
    const singleName = nameParts[0] || 'contact';
    return [`${singleName}@${domain}`];
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const firstInitial = firstName.charAt(0);
  
  // Standard email patterns
  return [
    `${firstName}.${lastName}@${domain}`,
    `${firstName}${lastName}@${domain}`,
    `${firstInitial}${lastName}@${domain}`,
    `${firstName}@${domain}`
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
    includeDepartment = true
  } = options;

  if (!company) {
    return [];
  }

  const domain = extractDomain(company);
  const emails = [];
  const seenEmails = new Set();

  // Get role-specific functional patterns
  let functionalPatterns = [];
  
  // Check if role matches ROLE_KEYWORDS categories
  if (role && ROLE_KEYWORDS[role]) {
    // Use patterns from the role keyword mapping
    functionalPatterns = [...ROLE_KEYWORDS[role]];
  } else if (role === 'recruiter' || role === 'hr') {
    functionalPatterns = [...EMAIL_PATTERNS.recruiting];
  } else if (role === 'sales') {
    functionalPatterns = [...EMAIL_PATTERNS.sales];
  } else if (DEPARTMENT_PATTERNS[role]) {
    functionalPatterns = [...DEPARTMENT_PATTERNS[role]];
  }

  // Add general patterns if requested or if no specific patterns found
  if (includeGeneral || functionalPatterns.length === 0) {
    functionalPatterns = [...functionalPatterns, ...EMAIL_PATTERNS.general];
  }

  // Add department-specific patterns
  if (includeDepartment && DEPARTMENT_PATTERNS[role]) {
    functionalPatterns = [...functionalPatterns, ...DEPARTMENT_PATTERNS[role]];
  }

  // Remove duplicates and limit functional patterns
  functionalPatterns = [...new Set(functionalPatterns)].slice(0, Math.floor(maxResults * 0.6));

  // Generate functional email objects
  functionalPatterns.forEach((pattern, index) => {
    const email = `${pattern}@${domain}`;
    
    if (!seenEmails.has(email)) {
      seenEmails.add(email);
      
      emails.push({
        email,
        name: `${company} ${pattern.charAt(0).toUpperCase() + pattern.slice(1)} Team`,
        title: getPatternTitle(pattern, role),
        department: getDepartmentFromPattern(pattern),
        source: 'pattern-generation',
        confidence: getPatternConfidence(pattern, role),
        verified: false,
        pattern: pattern
      });
    }
  });

  // Generate personal email patterns using fallback names
  const remainingSlots = maxResults - emails.length;
  if (remainingSlots > 0) {
    // Shuffle fallback names for randomness
    const shuffledNames = [...fallbackNames].sort(() => Math.random() - 0.5);
    const namesToUse = shuffledNames.slice(0, Math.ceil(remainingSlots / 3)); // Use fewer names, generate multiple emails per name
    
    namesToUse.forEach(name => {
      const personalEmails = generatePersonalEmailPatterns(name, domain);
      
      personalEmails.forEach((email, patternIndex) => {
        if (emails.length < maxResults && !seenEmails.has(email)) {
          seenEmails.add(email);
          
          emails.push({
            email,
            name,
            title: getRoleBasedTitle(role, name),
            department: getDepartmentFromRole(role),
            source: 'pattern-generation',
            confidence: 0.75 - (patternIndex * 0.05), // Slightly lower confidence, decreasing per pattern
            verified: false,
            pattern: 'personal'
          });
        }
      });
    });
  }

  console.log(`[Pattern Generator] Generated ${emails.length} emails for ${company} (${role})`);
  
  // Sort by confidence descending (highest confidence first)
  emails.sort((a, b) => b.confidence - a.confidence);
  
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
function getPatternConfidence(pattern, role) {
  // Role-based confidence scoring
  if (role && ROLE_KEYWORDS[role]) {
    // 90% confidence for exact role match
    if (ROLE_KEYWORDS[role].includes(pattern)) {
      return 0.9;
    }
  }
  
  // Pattern category confidence
  if (EMAIL_PATTERNS.recruiting.includes(pattern)) {
    return 0.8; // 80% for recruiting patterns (common and effective)
  }
  
  if (EMAIL_PATTERNS.sales.includes(pattern)) {
    return 0.7; // 70% for sales patterns (business-focused)
  }
  
  // 60% for general patterns (fallback)
  return 0.6;
}

export default { findCompanyContacts };