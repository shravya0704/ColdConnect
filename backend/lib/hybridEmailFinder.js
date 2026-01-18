/**
 * Hybrid Email Finder (Simplified + Error-Proof)
 * Combines Google Search, Pattern Fallback, and optional Verification.
 * All unsafe .map() calls removed; final return always stable.
 */

import NodeCache from "node-cache";
import { findCompanyContacts } from "./freeEmailFinder.js";
import { searchPeople } from "./googleSearchFinder.js";
import { isValidCompanyDomain, hasMxRecords } from "./utils/domain.js";

// Cache for 24 hours
const emailCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// ---------- Helpers ----------
const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
const safeMap = (arr, fn) => safeArray(arr).map(fn);

// Generate person-based patterns when a real name is available.
// We provide multiple patterns and medium/low confidence levels.
function generateEmailsForPeople(people, domain) {
  const safePeople = safeArray(people);
  const allEmails = [];

  for (const person of safePeople) {
    if (!person?.name) continue;
    // Only accept explicitly identified people
    const isExplicitPerson = person.isPerson === true || person.source === 'scrape' || person.source === 'google-company';
    if (!isExplicitPerson) continue;
    const lower = person.name.toLowerCase().trim();
    const parts = lower.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue; // require real-looking first + last
    const first = parts[0];
    const last = parts[parts.length - 1];
    const patterns = [
      { address: `${first}.${last}@${domain}`, level: 'Low', reason: 'Pattern-based, unverified (firstname.lastname)' },
      { address: `${first}${last}@${domain}`, level: 'Low', reason: 'Pattern-based, unverified (firstnamelastname)' },
      { address: `${first.charAt(0)}${last}@${domain}`, level: 'Low', reason: 'Pattern-based, unverified (initial+lastname)' },
    ];

    for (const p of patterns) {
      allEmails.push({
        email: p.address,
        type: 'Public contact',
        confidenceLevel: p.level,
        confidenceReason: p.reason,
        source: person.source || 'public-company-site',
        name: person.name,
        title: person.title || undefined
      });
    }
  }

  return allEmails.slice(0, 15); // limit
}

// No implicit domain guessing; require valid domain upstream per product policy

// ---------- Main Function ----------
export async function findEmailsWithHybrid(company, domain, role = "recruiter", options = {}) {
  const { maxResults = 10, useCache = true } = options;

  if (!company) {
    return { success: false, data: { contacts: [] }, count: 0, message: "Company name required" };
  }
  // Domain is immutable and must be provided explicitly by caller
  const finalDomain = String(domain || '').trim().toLowerCase();
  if (!isValidCompanyDomain(finalDomain)) {
    return { success: false, data: { contacts: [] }, count: 0, message: "Domain required and must be valid (e.g., microsoft.com). No auto-selection performed." };
  }
  const mxOk = await hasMxRecords(finalDomain);
  if (!mxOk) {
    return { success: false, data: { contacts: [] }, count: 0, message: "Domain invalid or not configured for email (no MX records)" };
  }

  company = String(company).trim();
  role = String(role).trim() || "decision maker";
  const cacheKey = `emails_${company}_${role}`;

  // Cache check
  if (useCache) {
    const cached = emailCache.get(cacheKey);
    if (cached) {
      console.log("[Email Finder] Returning cached results");
      return { ...cached, cached: true };
    }
  }

  let allEmails = [];
  const sources = [];

  // Big-company safety: disable person-based generation
  const BIG_COMPANY_ROOTS = new Set([
    'google','microsoft','amazon','meta','facebook','apple','netflix','linkedin','twitter','tesla','salesforce','adobe','oracle','ibm','intel','nvidia','paypal','dropbox','slack','shopify','stripe','square','twilio','github','gitlab','atlassian','mongodb','redis','docker'
  ]);
  const companyRoot = String(company).toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const domainRoot = finalDomain.split('.')[0];
  const isBigCo = BIG_COMPANY_ROOTS.has(companyRoot) || BIG_COMPANY_ROOTS.has(domainRoot);

  // 1️⃣ Optional: Try safe public name sourcing from company pages
  try {
    console.log("[Email Finder] Sourcing public names from company pages...");
    if (!isBigCo) {
      const publicPeople = await searchPeople({ company, domain: finalDomain, role, limit: 3 });
      if (publicPeople.length > 0) {
        const personEmails = generateEmailsForPeople(publicPeople, finalDomain);
        allEmails.push(...personEmails);
        sources.push("company-site");
        console.log(`[Email Finder] Company site provided ${personEmails.length} person-based patterns`);
      }
    } else {
      console.log("[Email Finder] Big company detected; skipping person-based generation");
    }
  } catch (err) {
    console.warn("[Email Finder] Name sourcing failed:", err.message);
  }

  // 2️⃣ Deterministic role-based inboxes (primary)
  console.log("[Email Finder] Adding role-based inboxes...");
  const rb = await findCompanyContacts(company, role, { maxResults, domain: finalDomain });
  const ALLOWED_ROLE_LOCAL_PARTS = new Set([
    // Hiring
    'careers','jobs','recruitment','recruiting','hr','talent',
    // Engineering
    'engineering','dev','tech',
    // General
    'info','contact','support',
    // Existing
    'press'
  ]);
  const safeRB = safeArray(rb)
    .map((r) => ({ ...r, email: r.email?.toLowerCase() }))
    .filter((r) => {
      const local = String(r.email || '').split('@')[0];
      return ALLOWED_ROLE_LOCAL_PARTS.has(local);
    });
  
  // Inject role-aware deterministic addresses to ensure coverage
  const makeAddress = (local) => ({
    email: `${local}@${finalDomain}`,
    type: 'Role-based',
    source: 'role-mapping'
  });
  const hiringLocals = ['careers','jobs','recruitment','recruiting','hr','talent'];
  const engineeringLocals = ['engineering','dev','tech'];
  const generalLocals = ['info','contact','support'];
  const injected = [];
  // Always ensure at least 2 hiring + 1 general fallback
  for (const l of hiringLocals.slice(0, 3)) injected.push(makeAddress(l));
  injected.push(makeAddress(generalLocals[0]));
  
  const combinedRoleBased = [...safeRB, ...injected];
  if (safeRB.length > 0) {
    allEmails.push(...safeRB);
    sources.push("role-based");
  }

  // ---------- Final Assembly ----------
  try {
    // Combine person-based and role-based
    allEmails.push(...combinedRoleBased);
    const unique = Array.from(new Map(safeArray(allEmails).map((e) => [e.email, e])).values());

    // Remove topic-based inboxes (privacy/legal/security/compliance/dataretention)
    const BLOCKED_KEYWORDS = [
      'privacy', 'legal', 'security', 'compliance', 'dataretention', 'retention',
      'dataprotection', 'dpo', 'gdpr', 'infosec', 'trustsafety', 'trustandsafety',
      'trust', 'securityops', 'secops', 'dataprivacy'
    ];
    const filtered = unique.filter((c) => {
      const local = String(c.email || '').split('@')[0].toLowerCase();
      const normalized = local.replace(/[^a-z]/g, '');
      // Block non-sense: local part must be either allowed role or composed of name tokens
      const allowedRole = ['careers','hiring','recruiting','hr','talent','jobs','press','info','contact'].includes(local);
      const allowedEngineering = ['engineering','dev','tech'].includes(local);
      const allowedGeneral = ['support'].includes(local) || ['info','contact'].includes(local);
      const isPerson = c.type === 'Public contact';
      const nameTokensOk = isPerson ? (() => {
        const name = String(c.name || '').toLowerCase();
        const tokens = name.split(/\s+/).filter(Boolean);
        const parts = local.split(/[._-]/).filter(Boolean);
        return parts.every(p => tokens.includes(p) || (p.length <= 2 && tokens.includes(tokens[0]?.[0])));
      })() : false;
      const notBlockedKeyword = !BLOCKED_KEYWORDS.some((kw) => normalized.includes(kw));
      return notBlockedKeyword && (allowedRole || allowedEngineering || allowedGeneral || nameTokensOk);
    });

    // Category mapping
    const categoryOf = (local) => {
      if (['careers','jobs','recruitment','recruiting','hr','talent'].includes(local)) return 'Hiring';
      if (['engineering','dev','tech'].includes(local)) return 'Engineering';
      return 'General';
    };
    const confidenceByCategory = (cat) => {
      if (cat === 'Hiring') return 'High';
      if (cat === 'Engineering') return 'Medium';
      return 'Low';
    };

    // Prioritize based on role: hiring first, then engineering, general fallback
    const sortPriority = (c) => {
      const local = String(c.email || '').split('@')[0].toLowerCase();
      const cat = categoryOf(local);
      if (role.toLowerCase().includes('engineering')) {
        return cat === 'Hiring' ? 0 : cat === 'Engineering' ? 1 : 2;
      }
      // default: hiring > general > engineering
      return cat === 'Hiring' ? 0 : cat === 'General' ? 1 : 2;
    };
    const ordered = filtered.sort((a, b) => sortPriority(a) - sortPriority(b));

    // Ensure transparent output structure
    const limited = safeMap(ordered.slice(0, maxResults), (c) => {
      const local = String(c.email || '').split('@')[0].toLowerCase();
      const cat = categoryOf(local);
      return {
        email: c.email,
        type: c.type || 'Role-based',
        category: cat,
        confidenceLevel: c.confidenceLevel || confidenceByCategory(cat),
        confidenceReason: c.confidenceReason || (c.type === 'Role-based'
          ? `${cat} inbox pattern; not verified`
          : 'Pattern-based, unverified from public name'),
        source: c.source || 'role-mapping',
        name: c.name,
        title: c.title
      };
    });

    if (limited.length === 0) {
      const result = { success: true, data: { contacts: [] }, count: 0, sources, cached: false, message: 'No public contacts found for this domain' };
      if (useCache) emailCache.set(cacheKey, result);
      return result;
    }

    const result = {
      success: true,
      data: { contacts: limited },
      count: limited.length,
      sources,
      cached: false,
    };

    if (useCache && limited.length > 0) emailCache.set(cacheKey, result);

    console.log(`[Email Finder] ✅ Returning ${limited.length} contacts`);
    return result;
  } catch (err) {
    console.error("[Email Finder] ❌ Final return error:", err.message);
    return { success: false, data: { contacts: [] }, count: 0, sources: [] };
  }
}

export default { findEmailsWithHybrid };
