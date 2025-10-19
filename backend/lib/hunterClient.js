import NodeCache from 'node-cache';

// Cache for 24 hours (86400 seconds)
const cache = new NodeCache({ stdTTL: 86400 });

/**
 * Generate cache key for Hunter requests
 * @param {string} firstName 
 * @param {string} lastName 
 * @param {string} domain 
 * @param {string} countryCode 
 * @returns {string}
 */
export function generateCacheKey(firstName, lastName, domain, countryCode) {
    return `hunter:${firstName?.toLowerCase() || ''}:${lastName?.toLowerCase() || ''}:${domain?.toLowerCase() || ''}:${countryCode || 'any'}`;
}

/**
 * Enrich recipient with Hunter.io email finder or domain search
 * @param {Object} recipient - { firstName, lastName, role, company, domain, locationRequested }
 * @param {Object} options - { countryCode?, enrichFlag? }
 * @returns {Promise<Object>} - { email, score, source, domainSearchResults?, error?, message?, raw? }
 */
export async function enrichWithHunter(recipient, options = {}) {
    try {
        // Early return if enrichment is disabled
        if (options.enrichFlag === false) {
            return { email: null, score: null, source: "none" };
        }

        const { firstName, lastName, domain } = recipient;
        const { countryCode } = options;

        // Check API key
        if (!process.env.HUNTER_API_KEY) {
            return { error: "auth", message: "Hunter API key not configured" };
        }

        // If we have firstName, lastName, and domain → use Email Finder API
        if (firstName && lastName && domain) {
            return await performEmailFinder(firstName, lastName, domain, countryCode);
        }

        // If we only have domain → use Domain Search API
        if (domain) {
            return await performDomainSearch(domain);
        }

        // Missing required fields
        return { email: null, score: null, source: "hunter", error: "missing_fields" };

    } catch (error) {
        console.error(`[Hunter] Unexpected error for ${recipient.firstName || 'unknown'} ${recipient.lastName || 'unknown'}:`, error.message);
        return { error: "api", message: "Network error" };
    }
}

/**
 * Perform Hunter.io Email Finder API call
 * @param {string} firstName 
 * @param {string} lastName 
 * @param {string} domain 
 * @param {string} countryCode 
 * @returns {Promise<Object>}
 */
async function performEmailFinder(firstName, lastName, domain, countryCode) {
    // Check cache first
    const cacheKey = generateCacheKey(firstName, lastName, domain, countryCode);
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
        console.log(`[Hunter] Cache hit for ${firstName} ${lastName} at ${domain}`);
        return { ...cachedResult, source: "hunter_cached" };
    }

    // Build API URL
    const baseUrl = 'https://api.hunter.io/v2/email-finder';
    const params = new URLSearchParams({
        domain: domain,
        first_name: firstName,
        last_name: lastName,
        api_key: process.env.HUNTER_API_KEY
    });

    if (countryCode) {
        params.append('country', countryCode);
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;

    console.log(`[Hunter] Email finder request for ${firstName} ${lastName} at ${domain}${countryCode ? ` (${countryCode})` : ''}`);

    // Make API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
            'User-Agent': 'ColdConnect/1.0'
        }
    });

    clearTimeout(timeoutId);

    // Log quota headers
    const rateLimit = response.headers.get('x-ratelimit-limit');
    const rateRemaining = response.headers.get('x-ratelimit-remaining');
    const rateReset = response.headers.get('x-ratelimit-reset');

    console.log(`[Hunter] Quota status for ${domain}: ${rateRemaining}/${rateLimit} remaining, resets: ${rateReset}`);

    // Check for quota exhaustion
    if (rateRemaining && parseInt(rateRemaining) <= 0) {
        return { error: "quota", message: "Hunter quota exhausted" };
    }

    // Handle HTTP errors
    if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 402) {
            return { error: "quota", message: "Hunter quota exhausted" };
        }

        if (response.status === 401 || response.status === 403) {
            return { error: "auth", message: "Hunter API key invalid/disabled" };
        }

        console.error(`[Hunter] API error ${response.status}:`, errorText);
        return { error: "api", message: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // Extract result
    const result = {
        email: data.data?.email || null,
        score: data.data?.score || null,
        source: "hunter",
        raw: data
    };

    // Cache the result
    cache.set(cacheKey, {
        email: result.email,
        score: result.score,
        source: "hunter"
    });

    console.log(`[Hunter] ${result.email ? 'Found' : 'No'} email for ${firstName} ${lastName} at ${domain}${result.score ? ` (score: ${result.score})` : ''}`);

    return result;
}

/**
 * Perform Hunter.io Domain Search API call
 * @param {string} domain 
 * @returns {Promise<Object>}
 */
async function performDomainSearch(domain) {
    // Check cache first for domain search
    const cacheKey = `domain_search:${domain.toLowerCase()}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
        console.log(`[Hunter] Cache hit for domain search: ${domain}`);
        return { ...cachedResult, source: "hunter_domain_cached" };
    }

    const searchUrl = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}&limit=10`;
    console.log(`[Hunter] Domain search used for ${domain}`);

    // Make API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for domain search

    const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
            'User-Agent': 'ColdConnect/1.0'
        }
    });

    clearTimeout(timeoutId);

    // Log quota headers
    const rateLimit = response.headers.get('x-ratelimit-limit');
    const rateRemaining = response.headers.get('x-ratelimit-remaining');
    const rateReset = response.headers.get('x-ratelimit-reset');

    console.log(`[Hunter] Quota status for ${domain}: ${rateRemaining}/${rateLimit} remaining, resets: ${rateReset}`);

    // Check for quota exhaustion
    if (rateRemaining && parseInt(rateRemaining) <= 0) {
        return { error: "quota", message: "Hunter quota exhausted" };
    }

    // Handle HTTP errors
    if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 402) {
            return { error: "quota", message: "Hunter quota exhausted" };
        }

        if (response.status === 401 || response.status === 403) {
            return { error: "auth", message: "Hunter API key invalid/disabled" };
        }

        console.error(`[Hunter] Domain search API error ${response.status}:`, errorText);
        return { error: "api", message: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.data || !data.data.emails || data.data.emails.length === 0) {
        console.log(`[Hunter] Domain search found 0 emails for ${domain}`);
        return { email: null, score: null, source: "hunter_domain", error: "no_results" };
    }

    // Filter for recruiter/HR/decision maker emails
    const recruiterKeywords = [
        'recruiter', 'recruiting', 'recruitment', 'talent', 'hr', 'human resources', 
        'people', 'hiring', 'manager', 'head', 'director', 'lead', 'chief', 
        'vp', 'vice president', 'ceo', 'cto', 'cfo', 'founder'
    ];

    let relevantEmails = data.data.emails.filter(email => {
        const position = (email.position || '').toLowerCase();
        const department = (email.department || '').toLowerCase();
        const pattern = (email.pattern || '').toLowerCase();
        const searchText = `${position} ${department} ${pattern}`;

        return recruiterKeywords.some(keyword => searchText.includes(keyword));
    });

    // If no recruiter emails found, fallback to high-confidence general emails
    if (relevantEmails.length === 0) {
        relevantEmails = data.data.emails.filter(email => email.confidence > 70);
    }

    // Sort by confidence and take top 3
    relevantEmails.sort((a, b) => b.confidence - a.confidence);
    const topEmails = relevantEmails.slice(0, 3);

    console.log(`[Hunter] Domain search found ${data.data.emails.length} total emails, ${relevantEmails.length} relevant emails for ${domain}`);

    const result = {
        email: topEmails[0]?.value || null,
        score: topEmails[0]?.confidence || null,
        source: "hunter_domain",
        domainSearchResults: topEmails.map(email => ({
            value: email.value,
            first_name: email.first_name,
            last_name: email.last_name,
            position: email.position,
            department: email.department,
            confidence: email.confidence
        })),
        raw: data
    };

    // Cache the result
    cache.set(cacheKey, {
        email: result.email,
        score: result.score,
        source: "hunter_domain",
        domainSearchResults: result.domainSearchResults
    });

    return result;
}

/**
 * Process multiple recipients with concurrency limit
 * @param {Array} recipients 
 * @param {Object} options 
 * @param {number} concurrency 
 * @returns {Promise<Array>}
 */
export async function enrichMultipleRecipients(recipients, options = {}, concurrency = 2) {
    const results = [];
    let quotaReached = false;

    // Process in batches with concurrency limit
    for (let i = 0; i < recipients.length; i += concurrency) {
        if (quotaReached) {
            // Add remaining recipients without enrichment
            for (let j = i; j < recipients.length; j++) {
                results.push({
                    ...recipients[j],
                    email: null,
                    score: null,
                    enrichedBy: "none",
                    enrichmentError: "quota_reached"
                });
            }
            break;
        }

        const batch = recipients.slice(i, i + concurrency);
        const batchPromises = batch.map(async (recipient) => {
            if (quotaReached) {
                return {
                    ...recipient,
                    email: null,
                    score: null,
                    enrichedBy: "none",
                    enrichmentError: "quota_reached"
                };
            }

            const enrichResult = await enrichWithHunter(recipient, options);

            if (enrichResult.error === "quota") {
                quotaReached = true;
                return {
                    ...recipient,
                    email: null,
                    score: null,
                    enrichedBy: "none",
                    enrichmentError: "quota_reached"
                };
            }

            return {
                ...recipient,
                email: enrichResult.email,
                score: enrichResult.score,
                enrichedBy: enrichResult.source,
                enrichmentError: enrichResult.error || null
            };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    return { results, quotaReached };
}