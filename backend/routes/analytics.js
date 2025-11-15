import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

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
