/**
 * Google Custom Search Email Finder
 * Uses Google Custom Search Engine to find people and contacts from company pages
 */

import fetch from 'node-fetch';

// Ethical constraint: Do NOT scrape LinkedIn. We restrict to public
// company pages like About/Team/Careers only.

/**
 * Search for people at a company using Google Custom Search
 * @param {Object} params - Search parameters
 * @param {string} params.company - Company name
 * @param {string} params.domain - Company domain
 * @param {string} params.role - Target role/department
 * @param {string} params.location - Location filter
 * @param {number} params.limit - Maximum results to return
 * @returns {Array} Array of person objects with name, title, link, snippet
 */
export async function searchPeople({ company, domain, role = '', location = '', limit = 5 }) {
  // Enhanced input sanitization to prevent broken queries
  if (typeof company !== 'string') {
    try {
      company = Object.values(company || {}).join(' ') || '';
    } catch {
      company = String(company || '').replace(/[^a-zA-Z0-9 ]/g, '');
    }
  }
  
  if (typeof role !== 'string') {
    try {
      role = Object.values(role || {}).join(' ') || '';
    } catch {
      role = String(role || '').replace(/[^a-zA-Z0-9 ]/g, '');
    }
  }

  // Clean inputs and remove problematic data
  company = company.replace(/true|false|\d+/gi, '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  role = role.replace(/true|false|\d+/gi, '').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'professional';
  domain = String(domain || '').replace(/[^a-zA-Z0-9.-]/g, '').trim();
  location = String(location || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();

  console.log(`[Google Search] Cleaned input → role="${role}", company="${company}", domain="${domain}"`);

  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_CX;
  const timeout = parseInt(process.env.GOOGLE_TIMEOUT_MS) || 5000;

  if (!apiKey || !searchEngineId) {
    console.log('[Google Search] API key or CX not configured, skipping Google search');
    return [];
  }

  // We require a domain to stay scoped to the company site.
  if (!company || !domain) {
    console.log('[Google Search] Missing company or domain, skipping search');
    return [];
  }

  try {
    // Build search queries for different scenarios
    const searchQueries = buildSearchQueries({ company, domain, role, location });
    
    const allResults = [];
    
    for (const query of searchQueries) {
      if (allResults.length >= limit) break;
      
      const searchUrl = buildSearchUrl(apiKey, searchEngineId, query);
      
      console.log(`[Google Search] Query: "${query}"`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'ColdConnect/1.0'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn(`[Google Search] API error: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        
        if (data.error) {
          console.warn(`[Google Search] API error: ${data.error.message}`);
          continue;
        }
        
        const results = parseSearchResults(data.items || [], company, domain);
        allResults.push(...results);
        
        console.log(`[Google Search] Found ${results.length} potential contacts from query`);
        
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn(`[Google Search] Request timeout after ${timeout}ms`);
        } else {
          console.warn(`[Google Search] Request failed: ${error.message}`);
        }
      }
    }
    
    // Remove duplicates and limit results
    const uniqueResults = removeDuplicates(allResults);
    const limitedResults = uniqueResults.slice(0, limit);
    
    console.log(`[Google Search] Returning ${limitedResults.length} unique contacts`);
    return limitedResults;
    
  } catch (error) {
    console.error(`[Google Search] Unexpected error: ${error.message}`);
    return [];
  }
}

/**
 * Build search queries for different scenarios
 */
function buildSearchQueries({ company, domain, role, location }) {
  const queries = [];
  
  // Base search terms limited to the company's own website only
  const baseTerms = [
    `site:${domain} "team" OR "staff" OR "about"`,
    `site:${domain} "careers" OR "our team"`,
    `site:${domain} ${role || 'team'} ${location || ''}`,
  ];
  
  // Role-specific searches
  if (role) {
    queries.push(
      `site:${domain} "${role}"`,
      `site:${domain} "${role}" "team"`,
    );
  }
  
  // Add base terms
  queries.push(...baseTerms);
  
  // Location-specific searches
  if (location) {
    queries.push(`site:${domain} "${location}" ${role || 'team'}`);
  }
  
  return queries.slice(0, 3); // Limit to 3 queries to avoid rate limits
}

/**
 * Build Google Custom Search URL
 */
function buildSearchUrl(apiKey, searchEngineId, query) {
  const baseUrl = 'https://www.googleapis.com/customsearch/v1';
  const params = new URLSearchParams({
    key: apiKey,
    cx: searchEngineId,
    q: query,
    num: '10',
    fields: 'items(title,link,snippet,displayLink)'
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Parse search results to extract person information
 */
function parseSearchResults(items, company, domain) {
  const people = [];
  
  for (const item of items) {
    try {
      const person = extractPersonInfo(item, company, domain);
      if (person) {
        people.push(person);
      }
    } catch (error) {
      console.warn(`[Google Search] Error parsing item: ${error.message}`);
    }
  }
  
  return people;
}

/**
 * Extract person information from search result item
 */
function extractPersonInfo(item, company, domain) {
  const { title, link, snippet, displayLink } = item;
  
  // Skip irrelevant results
  if (isIrrelevantResult(title, snippet, link)) {
    return null;
  }
  
  // We do NOT parse LinkedIn; only company website results are allowed
  // Extract from company website results
  if (displayLink && displayLink.includes(domain)) {
    return parseCompanyPageResult(title, snippet, link);
  }
  
  // Otherwise, ignore general web results to avoid third-party scraping
  return null;
}

/**
 * Check if result should be skipped
 */
function isIrrelevantResult(title, snippet, link) {
  const skipPatterns = [
    /jobs?|career|hiring|vacancy/i,
    /news|press|blog|article/i,
    /product|service|software/i,
    /\d{4}|\d{1,2}\/\d{1,2}/,  // Dates
    /linkedin\.com/i,            // Explicitly skip LinkedIn
  ];
  
  const content = `${title} ${snippet} ${link}`.toLowerCase();
  return skipPatterns.some(pattern => pattern.test(content));
}

/**
 * Parse LinkedIn search results
 */
// Removed LinkedIn parser by policy

/**
 * Parse company page results
 */
function parseCompanyPageResult(title, snippet, link) {
  // Look for names in titles and snippets
  const namePatterns = [
    /(?:meet|our team|about)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /([A-Z][a-z]+\s+[A-Z][a-z]+),\s*([^,\n]+)/,
  ];
  
  const content = `${title} ${snippet}`;
  
  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      if (!isPlausiblePersonName(candidate)) continue;
      return {
        name: candidate,
        title: match[2] ? cleanTitle(match[2].trim()) : '',
        link,
        snippet: snippet || '',
        source: 'google-company',
        isPerson: true
      };
    }
  }
  
  return null;
}

/**
 * Parse general search results
 */
// We no longer parse general results to avoid non-company sources

/**
 * Clean and normalize job titles
 */
function cleanTitle(title) {
  return title
    .replace(/\s*at\s+.+$/i, '')  // Remove "at Company"
    .replace(/\s*\|\s*.+$/, '')   // Remove "| Company"
    .replace(/^\s*-\s*/, '')      // Remove leading dash
    .trim();
}

// Strict filter to avoid arbitrary phrases being treated as names
function isPlausiblePersonName(name) {
  const n = String(name || '').trim();
  if (!/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(n)) return false;
  const parts = n.split(/\s+/);
  const blocklist = new Set([
    'States','Navy','About','Team','Contact','Support','Help','Sales','Marketing','Privacy','Legal','Security','Compliance','Careers','Jobs'
  ]);
  return !parts.some(p => blocklist.has(p));
}

/**
 * Remove duplicate people based on name similarity
 */
function removeDuplicates(people) {
  const seen = new Set();
  const unique = [];
  
  for (const person of people) {
    const key = person.name.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(person);
    }
  }
  
  return unique;
}

export default {
  searchPeople
};