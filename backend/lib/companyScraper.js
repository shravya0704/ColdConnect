/**
 * Company Website Scraper
 * Scrapes public company pages to find team members and contacts
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Scrape company public pages for team member information
 * @param {string} domain - Company domain to scrape
 * @returns {Array} Array of person objects with name, title, link
 */
export async function scrapeCompanyPublicPages(domain) {
  if (!domain) {
    console.log('[Company Scraper] No domain provided, skipping scrape');
    return [];
  }

  console.log(`[Company Scraper] Scraping public pages for ${domain}`);
  
  const results = [];
  const timeout = parseInt(process.env.SCRAPER_TIMEOUT_MS) || 10000;
  
  // Common page paths to check
  const pagesToScrape = [
    '/about',
    '/team',
    '/about-us',
    '/our-team',
    '/staff',
    '/leadership',
    '/management',
    '/careers',
    '/contact'
  ];
  
  for (const path of pagesToScrape) {
    try {
      const pageResults = await scrapePage(domain, path, timeout);
      results.push(...pageResults);
      
      // Avoid overwhelming the server
      await sleep(500);
      
    } catch (error) {
      console.warn(`[Company Scraper] Failed to scrape ${domain}${path}: ${error.message}`);
    }
  }
  
  // Remove duplicates and limit results
  const uniqueResults = removeDuplicateContacts(results);
  const limitedResults = uniqueResults.slice(0, 10);
  
  console.log(`[Company Scraper] Found ${limitedResults.length} potential contacts from ${domain}`);
  return limitedResults;
}

/**
 * Scrape a specific page for contact information
 */
async function scrapePage(domain, path, timeout) {
  const url = `https://${domain}${path}`;
  
  try {
    const response = await axios.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 400,
    });
    
    if (response.status === 200 && response.data) {
      return parsePageContent(response.data, url);
    }
    
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.warn(`[Company Scraper] Domain ${domain} not found`);
    } else if (error.code === 'ECONNABORTED') {
      console.warn(`[Company Scraper] Timeout scraping ${url}`);
    } else {
      console.warn(`[Company Scraper] Error scraping ${url}: ${error.message}`);
    }
  }
  
  return [];
}

/**
 * Parse HTML content to extract person information
 */
function parsePageContent(html, url) {
  const $ = cheerio.load(html);
  const people = [];
  
  // Remove script and style elements
  $('script, style, noscript').remove();
  
  try {
    // Strategy 1: Look for structured team sections
    const teamSections = $('[class*="team"], [id*="team"], [class*="staff"], [id*="staff"], [class*="about"], [id*="about"]');
    
    teamSections.each((_, element) => {
      const sectionPeople = extractFromTeamSection($(element));
      people.push(...sectionPeople);
    });
    
    // Strategy 2: Look for name-title patterns in text
    const bodyText = $('body').text();
    const textPeople = extractFromText(bodyText);
    people.push(...textPeople);
    
    // Strategy 3: Look for structured data (JSON-LD, microdata)
    const structuredPeople = extractFromStructuredData($);
    people.push(...structuredPeople);
    
  } catch (error) {
    console.warn(`[Company Scraper] Error parsing content from ${url}: ${error.message}`);
  }
  
  // Add source URL to all results
  return people.map(person => ({
    ...person,
    link: url,
    source: 'scrape'
  }));
}

/**
 * Extract people from team section HTML
 */
function extractFromTeamSection($section) {
  const people = [];
  
  // Look for common team member structures
  const memberSelectors = [
    '.team-member, .staff-member, .person, .employee',
    '[class*="member"], [class*="person"], [class*="staff"]',
    '.card, .profile, .bio'
  ];
  
  for (const selector of memberSelectors) {
    $section.find(selector).each((_, element) => {
      const $member = $(element);
      const person = extractPersonFromElement($member);
      if (person && person.name) {
        people.push(person);
      }
    });
  }
  
  return people;
}

/**
 * Extract person information from a DOM element
 */
function extractPersonFromElement($element) {
  let name = '';
  let title = '';
  
  // Try to find name
  const nameSelectors = [
    '.name, .fullname, .person-name, .member-name',
    'h1, h2, h3, h4, h5, h6',
    '.title:first-child',
    'strong:first-child, b:first-child'
  ];
  
  for (const selector of nameSelectors) {
    const nameEl = $element.find(selector).first();
    if (nameEl.length && nameEl.text().trim()) {
      const text = nameEl.text().trim();
      if (isValidName(text)) {
        name = text;
        break;
      }
    }
  }
  
  // Try to find title/role
  const titleSelectors = [
    '.title, .role, .position, .job-title',
    '.subtitle, .description',
    'p, .text',
    'em, .italic'
  ];
  
  for (const selector of titleSelectors) {
    const titleEl = $element.find(selector).first();
    if (titleEl.length && titleEl.text().trim()) {
      const text = titleEl.text().trim();
      if (isValidTitle(text) && text !== name) {
        title = text;
        break;
      }
    }
  }
  
  if (name) {
    return { name: cleanName(name), title: cleanTitle(title) };
  }
  
  return null;
}

/**
 * Extract people from plain text using patterns
 */
function extractFromText(text) {
  const people = [];
  
  // Pattern: "Name, Title" or "Name - Title"
  const patterns = [
    /([A-Z][a-z]+\s+[A-Z][a-z]+)[,\-\s]+([A-Z][^,.\n]{5,40})/g,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s*(?:is|serves as|works as)\s+([^,.\n]{5,40})/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null && people.length < 20) {
      const name = match[1].trim();
      const title = match[2].trim();
      
      if (isValidName(name) && isValidTitle(title)) {
        people.push({
          name: cleanName(name),
          title: cleanTitle(title)
        });
      }
    }
  }
  
  return people;
}

/**
 * Extract from structured data (JSON-LD, etc.)
 */
function extractFromStructuredData($) {
  const people = [];
  
  // Look for JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).html());
      const structuredPeople = extractFromJsonLd(data);
      people.push(...structuredPeople);
    } catch (error) {
      // Ignore invalid JSON
    }
  });
  
  return people;
}

/**
 * Extract people from JSON-LD structured data
 */
function extractFromJsonLd(data) {
  const people = [];
  
  if (Array.isArray(data)) {
    for (const item of data) {
      people.push(...extractFromJsonLd(item));
    }
  } else if (data && typeof data === 'object') {
    if (data['@type'] === 'Person' && data.name) {
      people.push({
        name: cleanName(data.name),
        title: cleanTitle(data.jobTitle || data.worksFor?.name || '')
      });
    } else if (data.employee && Array.isArray(data.employee)) {
      for (const employee of data.employee) {
        people.push(...extractFromJsonLd(employee));
      }
    }
  }
  
  return people;
}

/**
 * Validation functions
 */
function isValidName(text) {
  if (!text || text.length < 3 || text.length > 50) return false;
  
  // Must contain at least first and last name
  if (!/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text)) return false;
  
  // Exclude common false positives
  const excludePatterns = [
    /contact|email|phone|address/i,
    /\d{3,}|@|\.|www/,
    /company|team|staff|about/i
  ];
  
  return !excludePatterns.some(pattern => pattern.test(text));
}

function isValidTitle(text) {
  if (!text || text.length < 3 || text.length > 100) return false;
  
  // Exclude obvious non-titles
  const excludePatterns = [
    /^\d+$|^[a-z]|[.@]/,
    /contact|email|phone|address|website/i,
    /lorem|ipsum|dolor|amet/i
  ];
  
  return !excludePatterns.some(pattern => pattern.test(text));
}

/**
 * Cleaning functions
 */
function cleanName(name) {
  return name
    .replace(/[^\w\s.\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(title) {
  return title
    .replace(/[^\w\s.\-,&()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove duplicate contacts
 */
function removeDuplicateContacts(contacts) {
  const seen = new Set();
  const unique = [];
  
  for (const contact of contacts) {
    const key = contact.name.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key) && contact.name) {
      seen.add(key);
      unique.push(contact);
    }
  }
  
  return unique;
}

/**
 * Simple sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  scrapeCompanyPublicPages
};