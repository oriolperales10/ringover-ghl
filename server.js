require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const RINGOVER_API_KEY = process.env.RINGOVER_API_KEY || '6c230fd65d66143ebdf1748983fa174d8a4948d4';
const RINGOVER_BASE_URL = 'https://public-api.ringover.com/v2';
const PORT = process.env.PORT || 3000;

// ─── Utility ────────────────────────────────────────────────────────────────

function log(type, msg, data = null) {
  const ts = new Date().toISOString();
  const entry = { ts, type, msg, ...(data && { data }) };
  console.log(JSON.stringify(entry));
}

async function ringoverRequest(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': RINGOVER_API_KEY,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${RINGOVER_BASE_URL}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, data: json };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /ghl/call
 * Called by GHL Custom Action or Webhook when user clicks phone icon.
 * Body: { contact_phone: "+34612345678", agent_number: "+34911234567" (optional) }
 */
app.post('/ghl/call', async (req, res) => {
  try {
    const { contact_phone, agent_number, contact_name, contact_id } = req.body;

    if (!contact_phone) {
      return res.status(400).json({ success: false, error: 'contact_phone is required' });
    }

    // Normalize to E.164 without "+" (Ringover expects raw int64)
    const toNumber = parseInt(contact_phone.replace(/\D/g, ''), 10);
    const fromNumber = agent_number
      ? parseInt(agent_number.replace(/\D/g, ''), 10)
      : null;

    const payload = {
      to_number: toNumber,
      timeout: 45,
      device: 'ALL',
      clir: false,
    };
    if (fromNumber) payload.from_number = fromNumber;

    log('INFO', 'Initiating callback', { contact_name, contact_id, toNumber });

    const result = await ringoverRequest('POST', '/callback', payload);

    if (!result.ok) {
      log('ERROR', 'Ringover callback failed', result.data);
      return res.status(result.status).json({ success: false, error: result.data });
    }

    log('INFO', 'Call initiated', result.data);
    return res.json({ success: true, call_id: result.data.call_id, channel_id: result.data.channel_id });

  } catch (err) {
    log('ERROR', 'Unexpected error', { message: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /ghl/webhook
 * Generic GHL webhook — receives contact data and triggers call.
 * GHL sends: { phone: "...", firstName: "...", lastName: "...", id: "..." }
 */
app.post('/ghl/webhook', async (req, res) => {
  try {
    const body = req.body;
    log('INFO', 'GHL webhook received', body);

    // GHL can send different field names depending on the trigger
    const phone = body.phone || body.contact_phone || body.Phone || body.mobilePhone;
    const name = [body.firstName, body.lastName].filter(Boolean).join(' ') || body.full_name || 'Unknown';
    const contactId = body.id || body.contact_id;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'No phone number found in webhook payload' });
    }

    const toNumber = parseInt(phone.replace(/\D/g, ''), 10);

    const payload = { to_number: toNumber, timeout: 45, device: 'ALL', clir: false };

    log('INFO', `Calling ${name} (${phone})`, { contactId });

    const result = await ringoverRequest('POST', '/callback', payload);

    if (!result.ok) {
      log('ERROR', 'Ringover callback failed', result.data);
      return res.status(result.status).json({ success: false, error: result.data });
    }

    return res.json({ success: true, call_id: result.data.call_id, contact: name });

  } catch (err) {
    log('ERROR', 'Webhook error', { message: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /ringover/team
 * Proxy — returns your Ringover team info (users, numbers, etc.)
 */
app.get('/ringover/team', async (req, res) => {
  const result = await ringoverRequest('GET', '/teams');
  return res.status(result.status).json(result.data);
});

/**
 * GET /ringover/users
 * Returns all users/agents in the team
 */
app.get('/ringover/users', async (req, res) => {
  const result = await ringoverRequest('GET', '/users');
  return res.status(result.status).json(result.data);
});

/**
 * GET /ringover/numbers
 * Returns all numbers for the team
 */
app.get('/ringover/numbers', async (req, res) => {
  const result = await ringoverRequest('GET', '/numbers');
  return res.status(result.status).json(result.data);
});

/**
 * GET /ringover/calls
 * Returns recent calls (last 15 days by default)
 */
app.get('/ringover/calls', async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const path = `/calls?limit_count=${limit}&limit_offset=${offset}`;
  const result = await ringoverRequest('GET', path);
  return res.status(result.status).json(result.data);
});

/**
 * GET /health
 * Health check + API key test
 */
app.get('/health', async (req, res) => {
  const result = await ringoverRequest('GET', '/teams');
  return res.json({
    status: 'ok',
    ringover_connected: result.ok,
    ringover_status: result.status,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log('INFO', `Ringover-GHL bridge running on port ${PORT}`);
  log('INFO', `Dashboard: http://localhost:${PORT}`);
});
