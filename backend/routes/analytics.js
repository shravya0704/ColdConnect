import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// GET /api/analytics - Dashboard summary expected by frontend
// Returns shape: { success: true, data: { total_sent, total_replied, total_bounced, reply_rate, most_popular_tone, top_purpose, recent_emails } }
router.get('/', async (_req, res) => {
  try {
    const { data: allEmails, error: fetchError } = await supabase
      .from('emails')
      .select('id, status, company, purpose, tone, created_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[Analytics] Fetch error:', fetchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch email analytics',
        details: fetchError.message
      });
    }

    const rows = Array.isArray(allEmails) ? allEmails : [];

    const totalSent = rows.length;
    const totalReplied = rows.filter(email => String(email.status).toLowerCase() === 'replied').length;
    const totalBounced = rows.filter(email => String(email.status).toLowerCase() === 'bounced').length;
    const replyRate = totalSent > 0 ? (totalReplied / totalSent) : 0;

    // Most popular tone
    const toneCounts = {};
    for (const email of rows) {
      const t = email.tone || 'unknown';
      toneCounts[t] = (toneCounts[t] || 0) + 1;
    }
    const mostPopularTone = Object.keys(toneCounts).length
      ? Object.keys(toneCounts).sort((a, b) => toneCounts[b] - toneCounts[a])[0]
      : 'N/A';

    // Top purpose
    const purposeCounts = {};
    for (const email of rows) {
      const p = email.purpose || 'unknown';
      purposeCounts[p] = (purposeCounts[p] || 0) + 1;
    }
    const topPurpose = Object.keys(purposeCounts).length
      ? Object.keys(purposeCounts).sort((a, b) => purposeCounts[b] - purposeCounts[a])[0]
      : 'N/A';

    // Recent emails (last 10)
    const recentEmails = rows.slice(0, 10).map(email => ({
      id: email.id,
      company: email.company,
      purpose: email.purpose,
      tone: email.tone,
      status: email.status,
      created_at: email.created_at
    }));

    return res.json({
      success: true,
      data: {
        total_sent: totalSent,
        total_replied: totalReplied,
        total_bounced: totalBounced,
        reply_rate: Math.round(replyRate * 100), // percentage integer
        most_popular_tone: mostPopularTone,
        top_purpose: topPurpose,
        recent_emails: recentEmails
      }
    });
  } catch (error) {
    console.error('[Analytics] Get / error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/analytics/log
// body: { event_type, tone, purpose, company, result }
router.post('/log', async (req, res) => {
  try {
    const { event_type, tone, purpose, company, result } = req.body || {};
    if (!event_type) return res.status(400).json({ error: 'event_type is required' });

    const payload = {
      event_type,
      tone: tone || null,
      purpose: purpose || null,
      company: company || null,
      result: typeof result === 'object' ? JSON.stringify(result) : result || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('analytics').insert([payload]);
    if (error) {
      console.error('[Analytics] Insert error:', error.message || error);
      return res.status(500).json({ success: false, error: 'Failed to log analytics' });
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('[Analytics] Unexpected error in /log:', err && (err.stack || err.message || err));
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/analytics/summary
router.get('/summary', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('analytics').select('*');
    if (error) {
      console.error('[Analytics] Select error:', error.message || error);
      return res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
    }

    const rows = Array.isArray(data) ? data : [];

    const totalEmails = rows.filter(r => String(r.event_type) === 'generate_email').length;
    const composeClicks = rows.filter(r => String(r.event_type) === 'compose_click').length;
    const totalFeedbacks = rows.filter(r => String(r.event_type) === 'feedback_reply').length;

    // topTone and topPurpose
    const toneCounts = {};
    const purposeCounts = {};
    const feedbackCounts = {};

    for (const r of rows) {
      const t = r.tone || 'unknown';
      toneCounts[t] = (toneCounts[t] || 0) + 1;
      const p = r.purpose || 'unknown';
      purposeCounts[p] = (purposeCounts[p] || 0) + 1;
      const resKey = r.result ? String(r.result) : 'unknown';
      feedbackCounts[resKey] = (feedbackCounts[resKey] || 0) + 1;
    }

    const topTone = Object.keys(toneCounts).sort((a,b)=> toneCounts[b]-toneCounts[a])[0] || null;
    const topPurpose = Object.keys(purposeCounts).sort((a,b)=> purposeCounts[b]-purposeCounts[a])[0] || null;

    return res.json({
      success: true,
      totalEmails,
      composeClicks,
      totalFeedbacks,
      topTone,
      topPurpose,
      feedbackCounts
    });
  } catch (err) {
    console.error('[Analytics] Unexpected error in /summary:', err && (err.stack || err.message || err));
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
