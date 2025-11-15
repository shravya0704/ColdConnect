import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

// POST /api/emails/add - Save a new email record
router.post('/add', async (req, res) => {
  try {
    const { emailBody, company, domain, purpose, tone } = req.body;
    
    // Validate required fields
    if (!emailBody || !company || !domain || !purpose || !tone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: emailBody, company, domain, purpose, tone' 
      });
    }

    // Insert new email record with status="sent"
    const { data, error } = await supabase
      .from('emails')
      .insert([{
        email_body: emailBody,
        company,
        domain,
        purpose,
        tone,
        status: 'sent',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('[Emails] Insert error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save email record',
        details: error.message 
      });
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        company: data.company,
        domain: data.domain,
        purpose: data.purpose,
        tone: data.tone,
        status: data.status,
        created_at: data.created_at
      }
    });
  } catch (error) {
    console.error('[Emails] Add email error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// POST /api/emails/update-status - Update email status
router.post('/update-status', async (req, res) => {
  try {
    const { emailId, status } = req.body;
    
    // Validate required fields
    if (!emailId || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: emailId, status' 
      });
    }

    // Validate status values
    const validStatuses = ['sent', 'replied', 'no_reply', 'bounced'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be: sent, replied, no_reply, or bounced' 
      });
    }

    // Update email status
    const { data, error } = await supabase
      .from('emails')
      .update({ 
        status
      })
      .eq('id', emailId)
      .select()
      .single();

    if (error) {
      console.error('[Emails] Update status error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update email status',
        details: error.message 
      });
    }

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'Email not found' 
      });
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        company: data.company,
        status: data.status,
        created_at: data.created_at
      }
    });
  } catch (error) {
    console.error('[Emails] Update status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// GET /api/analytics - Get email analytics
router.get('/', async (req, res) => {
  try {
    // Get total counts by status
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

    // Calculate analytics
    const totalSent = allEmails.length;
    const totalReplied = allEmails.filter(email => email.status === 'replied').length;
    const totalBounced = allEmails.filter(email => email.status === 'bounced').length;
    const replyRate = totalSent > 0 ? (totalReplied / totalSent) : 0;

    // Calculate most popular tone
    const toneCounts = {};
    allEmails.forEach(email => {
      toneCounts[email.tone] = (toneCounts[email.tone] || 0) + 1;
    });
    const mostPopularTone = Object.keys(toneCounts).reduce((a, b) => 
      toneCounts[a] > toneCounts[b] ? a : b, Object.keys(toneCounts)[0] || 'N/A'
    );

    // Calculate top purpose
    const purposeCounts = {};
    allEmails.forEach(email => {
      purposeCounts[email.purpose] = (purposeCounts[email.purpose] || 0) + 1;
    });
    const topPurpose = Object.keys(purposeCounts).reduce((a, b) => 
      purposeCounts[a] > purposeCounts[b] ? a : b, Object.keys(purposeCounts)[0] || 'N/A'
    );

    // Get recent emails (last 10)
    const recentEmails = allEmails.slice(0, 10).map(email => ({
      id: email.id,
      company: email.company,
      purpose: email.purpose,
      tone: email.tone,
      status: email.status,
      created_at: email.created_at
    }));

    res.json({
      success: true,
      data: {
        total_sent: totalSent,
        total_replied: totalReplied,
        total_bounced: totalBounced,
        reply_rate: Math.round(replyRate * 100) / 100, // Round to 2 decimal places
        most_popular_tone: mostPopularTone,
        top_purpose: topPurpose,
        recent_emails: recentEmails
      }
    });
  } catch (error) {
    console.error('[Analytics] Get analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

export default router;