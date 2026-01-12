import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Simple Supabase JWT validation via Auth API
// Requires Authorization: Bearer <access_token> header from Supabase client
export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing bearer token' });
    }

    const token = authHeader.substring('Bearer '.length);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ success: false, error: 'Auth not configured' });
    }

    // Validate token by calling Supabase Auth /user endpoint
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!resp.ok) {
      return res.status(401).json({ success: false, error: 'Unauthorized: invalid token' });
    }

    const user = await resp.json();
    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth] Middleware error:', err?.message || err);
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}

export default authMiddleware;
