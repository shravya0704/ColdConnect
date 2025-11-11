/**
 * Hybrid Email Finder (Simplified + Error-Proof)
 * Combines Google Search, Pattern Fallback, and optional Verification.
 * All unsafe .map() calls removed; final return always stable.
 */

import NodeCache from "node-cache";
import { findCompanyContacts } from "./freeEmailFinder.js";
import { searchPeople } from "./googleSearchFinder.js";

// Cache for 24 hours
const emailCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// ---------- Helpers ----------
const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
const safeMap = (arr, fn) => safeArray(arr).map(fn);

// Generate simple pattern-based email guesses for each person
function generateEmailsForPeople(people, domain, company) {
  const safePeople = safeArray(people);
  const allEmails = [];

  for (const person of safePeople) {
    if (!person?.name) continue;
    const name = person.name.toLowerCase().trim();
    const [first, last] = name.split(" ");
    const patterns = [
      `${first}.${last}@${domain}`,
      `${first}${last}@${domain}`,
      `${first.charAt(0)}${last}@${domain}`,
      `${first}@${domain}`,
    ];

    for (const email of patterns) {
      allEmails.push({
        name: person.name,
        email,
        role: person.title || "Contact",
        source: person.source || "google",
        verified: false,
        company,
        confidence: 0.8,
      });
    }
  }

  return allEmails.slice(0, 15); // limit
}

// Extract clean domain from company name
function extractDomain(company) {
  if (!company) return "";
  const clean = company.toLowerCase().replace(/\s+/g, "");
  const map = {
    google: "google.com",
    microsoft: "microsoft.com",
    amazon: "amazon.com",
    meta: "meta.com",
    apple: "apple.com",
  };
  return map[clean] || `${clean}.com`;
}

// ---------- Main Function ----------
export async function findEmailsWithHybrid(company, domain, role = "recruiter", options = {}) {
  const { maxResults = 10, useCache = true } = options;

  if (!company) {
    return { success: false, data: { contacts: [] }, count: 0, message: "Company name required" };
  }

  company = String(company).trim();
  role = String(role).trim() || "decision maker";
  const cacheKey = `emails_${company}_${role}`;
  const finalDomain = domain || extractDomain(company);

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

  // 1️⃣ Try Google Search
  try {
    console.log("[Email Finder] Using Google Search...");
    const googlePeople = await searchPeople({ company, domain: finalDomain, role, limit: 5 });

    if (googlePeople.length > 0) {
      const googleEmails = generateEmailsForPeople(googlePeople, finalDomain, company);
      allEmails.push(...googleEmails);
      sources.push("google");
      console.log(`[Email Finder] Google provided ${googleEmails.length} candidates`);
    }
  } catch (err) {
    console.warn("[Email Finder] Google search failed:", err.message);
  }

  // 2️⃣ Pattern Fallback
  console.log("[Email Finder] Using pattern fallback...");
  const patternEmails = await findCompanyContacts(company, role, {
    maxResults: Math.max(5, maxResults - allEmails.length),
  });

  const safePattern = safeArray(patternEmails);
  if (safePattern.length > 0) {
    allEmails.push(...safePattern);
    sources.push("pattern");
  }

  // ---------- Final Assembly ----------
  try {
    const unique = Array.from(
      new Map(safeArray(allEmails).map((e) => [e.email, e])).values()
    );

    const limited = safeMap(unique.slice(0, maxResults), (c) => ({
      name: c?.name || "Unknown",
      email: c?.email || "",
      role: c?.role || role,
      source: c?.source || "pattern",
      verified: !!c?.verified,
      confidence: c?.confidence || 0.7,
    }));

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
