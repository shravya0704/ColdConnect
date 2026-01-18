// Domain utilities: resolution, validation (syntax + MX), and safety gates
// Requirements:
// - Must contain a dot (.) and only valid chars
// - Must not be obvious role/industry keywords
// - Prefer domains that have MX records
// - Provide company→domain resolution for common firms

import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

const BLOCKLIST_KEYWORDS = [
  'web', 'development', 'software', 'developer', 'engineering', 'marketing',
  'sales', 'design', 'startup', 'agency', 'portfolio', 'recruiter', 'hr',
  'talent', 'jobs', 'hiring', 'career', 'careers', 'consulting'
];

export function isValidCompanyDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;

  const d = domain.trim().toLowerCase();
  if (!d || d.includes(' ')) return false;
  if (!d.includes('.')) return false;

  // Very small sanity check: only letters, numbers, dash, dot
  if (!/^[a-z0-9.-]+$/.test(d)) return false;

  // Block obvious non-company keywords as the whole domain (before dot)
  const root = d.split('.')[0] || '';
  if (BLOCKLIST_KEYWORDS.includes(root)) return false;

  // Looks acceptable
  return true;
}

/**
 * Attempt MX resolution; returns true only if MX records exist.
 * Fails closed on DNS/lookup errors.
 */
export async function hasMxRecords(domain) {
  try {
    const d = String(domain || '').trim().toLowerCase();
    if (!isValidCompanyDomain(d)) return false;
    const records = await resolveMx(d);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

// Common company domain map for auto-resolution
const COMPANY_DOMAIN_MAP = {
  google: 'google.com',
  microsoft: 'microsoft.com',
  amazon: 'amazon.com',
  meta: 'meta.com',
  facebook: 'meta.com',
  apple: 'apple.com',
  netflix: 'netflix.com',
  uber: 'uber.com',
  airbnb: 'airbnb.com',
  spotify: 'spotify.com',
  linkedin: 'linkedin.com',
  twitter: 'twitter.com',
  tesla: 'tesla.com',
  salesforce: 'salesforce.com',
  adobe: 'adobe.com',
  oracle: 'oracle.com',
  ibm: 'ibm.com',
  intel: 'intel.com',
  nvidia: 'nvidia.com',
  paypal: 'paypal.com',
  dropbox: 'dropbox.com',
  slack: 'slack.com',
  zoom: 'zoom.us',
  shopify: 'shopify.com',
  stripe: 'stripe.com',
  square: 'squareup.com',
  twilio: 'twilio.com',
  github: 'github.com',
  gitlab: 'gitlab.com',
  atlassian: 'atlassian.com',
  mongodb: 'mongodb.com',
  redis: 'redis.com',
  docker: 'docker.com',
};

/**
 * Resolve a plausible domain from a company name.
 * Uses common map first, then `${clean}.com`.
 */
export function resolveCompanyDomain(company) {
  if (!company) return '';
  const clean = String(company)
    .toLowerCase()
    .replace(/\s*(inc|ltd|llc|corp|corporation|company|co\.?|plc)\.?\s*$/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
  return COMPANY_DOMAIN_MAP[clean] || `${clean}.com`;
}

export default { isValidCompanyDomain, hasMxRecords, resolveCompanyDomain };
