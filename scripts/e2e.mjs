import pg from 'pg';
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3111';
const email = `e2e-${Date.now()}@example.com`, password = 'E2E-correct-horse-battery-staple';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let checks = 0;
const cookieValues = r => r.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
const csrf = c => decodeURIComponent(c.split('; ').find(x => x.startsWith('aurum_csrf='))?.split('=')[1] || '');
async function call(path, { method = 'GET', body, cookie, token, raw } = {}) {
  const r = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': raw ? 'text/csv' : 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(token ? { 'x-csrf-token': token } : {}), origin: base }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  let json = {}; try { json = await r.json(); } catch { /* non-JSON */ } return { r, json };
}
function expect(v, m) { if (!v) throw new Error(m); checks++; }
async function cleanup() {
  const tp = "select id from aurum_acquisition.prospects where is_test";
  await pool.query(`delete from aurum_acquisition.orders where prospect_id in (${tp}) or referred_by_partner_id in (${tp})`);
  await pool.query(`delete from aurum_acquisition.consultations where prospect_id in (${tp}) or referred_by_partner_id in (${tp})`);
  await pool.query(`delete from aurum_acquisition.suppressions where prospect_id in (${tp})`);
  await pool.query(`delete from aurum_acquisition.audit_events where entity_id in (select id::text from aurum_acquisition.prospects where is_test) or actor_id in (select id from aurum_acquisition.users where email like 'e2e-%@example.com')`);
  await pool.query(`delete from aurum_acquisition.approvals where entity_id in (${tp})`);
  await pool.query(`delete from aurum_acquisition.prospects where is_test`);
  await pool.query(`delete from aurum_acquisition.users where email like 'e2e-%@example.com'`);
}
try {
  await cleanup();
  let x = await call('/api/auth/bootstrap', { method: 'POST', body: { email, displayName: 'E2E Owner', password, bootstrapToken: process.env.ADMIN_BOOTSTRAP_TOKEN } });
  expect(x.r.status === 200, `bootstrap ${x.r.status} ${JSON.stringify(x.json)}`);
  const cookie = cookieValues(x.r), token = csrf(cookie); expect(cookie.includes('aurum_session=') && token, 'session/CSRF cookies missing');
  x = await call('/api/prospects', { method: 'POST', body: {} }); expect(x.r.status === 401, 'unauthenticated mutation not denied');
  x = await call('/api/prospects', { method: 'POST', body: {}, cookie }); expect(x.r.status === 403, 'mutation without CSRF token not denied');
  for (const p of ['/api/messages', '/api/inbound', '/api/integrations/gmail/connect', '/api/settings', '/api/eligibility']) { const r = await fetch(base + p, { method: 'POST' }); expect(r.status === 404, `removed route ${p} still responds ${r.status}`); }
  const { rows: [src] } = await pool.query("select id from aurum_acquisition.sources where name='First-party referral research'");
  const partnerBody = { sourceId: src.id, displayName: 'E2E Planner Fixture', organisation: 'E2E Planner Fixture', city: 'Bengaluru', category: 'referral_partner', sourceUrl: 'https://example.com/e2e', evidenceType: 'commercial_relevance', excerpt: 'Controlled E2E wedding planner fixture', summary: 'Controlled E2E wedding planner fixture', evidenceConfidence: 80, contact: { channel: 'phone', value: '+918041239999' }, isTest: true };
  x = await call('/api/prospects', { method: 'POST', body: partnerBody, cookie, token }); expect(x.r.status === 201, `partner create ${x.r.status} ${JSON.stringify(x.json)}`);
  const partnerId = x.json.prospectId, contactId = x.json.contactId;
  x = await call('/api/prospects', { method: 'POST', body: partnerBody, cookie, token }); expect(x.r.status === 400 && /Duplicate/.test(x.json.error), 'duplicate contact accepted');
  x = await call('/api/import', { method: 'POST', raw: true, body: 'name,category,source_url,evidence,is_test\nE2E CSV Partner,referral_partner,https://example.com,Controlled CSV referral evidence,true', cookie, token }); expect(x.r.status === 200 && x.json.imported === 1, 'CSV import failed');
  x = await call('/api/calls', { method: 'POST', body: { contactId, outcome: 'no_answer', dndChecked: false }, cookie, token }); expect(x.r.status === 400, 'call logged without DND confirmation');
  x = await call('/api/calls', { method: 'POST', body: { contactId, outcome: 'callback_requested', dndChecked: true }, cookie, token }); expect(x.r.status === 400 && /date/.test(x.json.error), 'callback without date accepted');
  x = await call('/api/calls', { method: 'POST', body: { contactId, outcome: 'callback_requested', dndChecked: true, durationMinutes: 4, followUpAt: new Date(Date.now() - 60000).toISOString(), notes: 'E2E' }, cookie, token }); expect(x.r.status === 201, 'callback log failed');
  let { rows: [pr] } = await pool.query('select partner_stage, next_follow_up_at from aurum_acquisition.prospects where id=$1', [partnerId]); expect(pr.partner_stage === 'contacted' && pr.next_follow_up_at, 'call did not advance stage or set follow-up');
  for (const stage of ['meeting_held', 'agreed']) { x = await call('/api/partners', { method: 'PATCH', body: { prospectId: partnerId, stage, note: 'E2E' }, cookie, token }); expect(x.r.ok, `stage ${stage} failed`); }
  x = await call('/api/referrals', { method: 'POST', body: { partnerId, customerName: 'E2E Referred Customer', customerPhone: '+919845099999', requirement: 'Wedding sherwani', status: 'completed' }, cookie, token }); expect(x.r.status === 201, `referral ${x.r.status} ${JSON.stringify(x.json)}`);
  const { customerId, consultationId } = x.json;
  x = await call('/api/orders', { method: 'POST', body: { prospectId: customerId, consultationId, status: 'confirmed', description: 'E2E sherwani', quotedInr: 90000, revenueInr: 50000, costInr: 20000 }, cookie, token }); expect(x.r.status === 201 && x.json.referredByPartnerId === partnerId, 'order not attributed to referring partner');
  x = await call('/api/partners', { cookie }); expect(x.r.ok && !x.json.rows.some(r => r.id === partnerId), 'test partner leaked into default scorecard');
  x = await call('/api/partners?includeTest=1', { cookie }); const row = x.json.rows.find(r => r.id === partnerId);
  expect(row && row.callsAttempted === 1 && row.callsAnswered === 1 && row.minutesSpent === 4 && row.meetings === 1 && row.referrals === 1 && row.consultationsCompleted === 1 && row.ordersWon === 1 && row.revenueInr === 50000 && row.marginInr === 30000 && row.stage === 'active', `scorecard wrong: ${JSON.stringify(row)}`);
  x = await call('/api/calls', { method: 'POST', body: { contactId, outcome: 'do_not_call', dndChecked: true }, cookie, token }); expect(x.r.status === 201, 'do-not-call log failed');
  x = await call('/api/calls', { method: 'POST', body: { contactId, outcome: 'no_answer', dndChecked: true }, cookie, token }); expect(x.r.status === 400 && /suppressed/.test(x.json.error), 'suppressed number accepted');
  const h = await fetch(base + '/api/health'); expect(h.ok, 'health failed');
  console.log(JSON.stringify({ ok: true, checks, emailSendingRoutes: 'removed (404)', testDataInDefaultReports: false }));
} finally { await cleanup(); await pool.end(); }
