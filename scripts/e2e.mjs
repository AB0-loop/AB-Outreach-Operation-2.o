import pg from 'pg';
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3111';
const email=`e2e-${Date.now()}@example.com`,password='E2E-correct-horse-battery-staple';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
let prospectId,messageId,mailboxId,importedProspectId;
function cookieValues(response){return response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')}
function csrf(cookie){return decodeURIComponent(cookie.split('; ').find(x=>x.startsWith('aurum_csrf='))?.split('=')[1]||'')}
async function call(path,{method='GET',body,cookie,csrfToken}={}){const r=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...(csrfToken?{'x-csrf-token':csrfToken}:{}),origin:base},body:body?JSON.stringify(body):undefined});let json={};try{json=await r.json()}catch{}return{r,json}}
function expect(value,message){if(!value)throw new Error(message)}
async function cleanup(){await pool.query("delete from aurum_acquisition.suppressions where source in ('test','interaction') and reason in ('E2E suppression','Recipient opted out')");if(messageId)await pool.query('delete from aurum_acquisition.send_attempts where message_id=$1',[messageId]);if(importedProspectId)await pool.query('delete from aurum_acquisition.prospects where id=$1',[importedProspectId]);if(prospectId){await pool.query("delete from aurum_acquisition.approvals where entity_id=$1 or entity_id=$2",[prospectId,messageId]);await pool.query('delete from aurum_acquisition.orders where prospect_id=$1',[prospectId]);await pool.query('delete from aurum_acquisition.consultations where prospect_id=$1',[prospectId]);await pool.query('delete from aurum_acquisition.prospects where id=$1',[prospectId]);}if(mailboxId)await pool.query('delete from aurum_acquisition.mailboxes where id=$1',[mailboxId]);await pool.query('delete from aurum_acquisition.users where email=$1',[email]);await pool.query("delete from aurum_acquisition.audit_events where metadata->>'e2e'='true' or summary like '%E2E%'");}
try{
 await cleanup();
 let x=await call('/api/auth/bootstrap',{method:'POST',body:{email,displayName:'E2E Owner',password,bootstrapToken:process.env.ADMIN_BOOTSTRAP_TOKEN}});expect(x.r.status===200,`bootstrap ${x.r.status} ${JSON.stringify(x.json)}`);const cookie=cookieValues(x.r),token=csrf(cookie);expect(cookie.includes('aurum_session=')&&token,'cookies missing');
 x=await call('/api/prospects',{method:'POST',body:{},cookie:undefined});expect(x.r.status===401,'unauthorised mutation was not denied');
 const {rows:[source]}=await pool.query("select id from aurum_acquisition.sources where name='Aurum website inbound'");
 const prospect={sourceId:source.id,displayName:'E2E Inbound Fixture',city:'Bengaluru',category:'inbound',sourceUrl:'https://aurumbespoke.com/',evidenceType:'need',excerpt:'Controlled E2E consultation request fixture',summary:'Controlled E2E consultation request fixture',evidenceConfidence:95,contact:{channel:'email',value:email},inbound:true,isTest:true};
 x=await call('/api/prospects',{method:'POST',body:prospect,cookie,csrfToken:token});expect(x.r.status===201,`prospect ${x.r.status} ${JSON.stringify(x.json)}`);prospectId=x.json.prospectId;
 const duplicate=await call('/api/prospects',{method:'POST',body:prospect,cookie,csrfToken:token});expect(duplicate.r.status===400&&/Duplicate/.test(duplicate.json.error),'duplicate contact was accepted');
 let detail=await call(`/api/prospects/${prospectId}`,{cookie});const contactId=detail.json.contacts[0].id;
 x=await call('/api/approvals',{method:'POST',body:{entityType:'prospect',entityId:prospectId,decision:'approved',note:'E2E review'},cookie,csrfToken:token});expect(x.r.ok,'prospect approval failed');
 x=await call('/api/eligibility',{method:'POST',body:{prospectId,contactId,sourceUseAllowed:true,relationshipBasis:'inbound_request',legalReviewComplete:true,purpose:'Respond to requested consultation',validDays:30},cookie,csrfToken:token});expect(x.json.status==='eligible','exact contact not eligible');
 x=await call('/api/messages',{method:'POST',body:{prospectId,contactId,subject:'E2E consultation follow-up',bodyText:'Hello, this is a controlled E2E message that must never be sent.',claims:[]},cookie,csrfToken:token});expect(x.r.status===201,'message create failed');messageId=x.json.id;
 x=await call('/api/approvals',{method:'POST',body:{entityType:'message',entityId:messageId,decision:'approved',note:'E2E message review'},cookie,csrfToken:token});expect(x.r.ok,'message approval failed');
 x=await call(`/api/messages/${messageId}/dry-run`,{method:'POST',body:{idempotencyKey:`e2e:dry:${crypto.randomUUID()}`},cookie,csrfToken:token});expect(x.r.ok&&x.json.providerInvoked===false,'dry run could invoke provider');
 const {rows:[mailbox]}=await pool.query("insert into aurum_acquisition.mailboxes(email,status,scopes,encrypted_refresh_token,key_version) values($1,'connected','[]','never-decrypted','test') returning id",[`mailbox-${email}`]);mailboxId=mailbox.id;
 const {rows:[contact]}=await pool.query('select fingerprint from aurum_acquisition.contacts where id=$1',[contactId]);
 x=await call('/api/suppressions',{method:'POST',body:{contactFingerprint:contact.fingerprint,channel:'email',reason:'E2E suppression',source:'test'},cookie,csrfToken:token});expect(x.r.status===201,'suppression failed');
 const sendKey=`e2e:send:${crypto.randomUUID()}`;x=await call(`/api/messages/${messageId}/send`,{method:'POST',body:{mailboxId,idempotencyKey:sendKey},cookie,csrfToken:token});expect(x.r.status===409&&x.json.blockers.some(b=>/suppression/.test(b)),'suppressed live send was not blocked');
 const repeat=await call(`/api/messages/${messageId}/send`,{method:'POST',body:{mailboxId,idempotencyKey:sendKey},cookie,csrfToken:token});expect(repeat.r.status>=400,'repeated send request was accepted');
 x=await call('/api/interactions',{method:'POST',body:{prospectId,type:'opt_out',classification:'opt_out',channel:'email',body:'E2E opt-out',occurredAt:new Date().toISOString()},cookie,csrfToken:token});expect(x.r.status===201,'opt out failed');
 x=await call('/api/consultations',{method:'POST',body:{prospectId,status:'booked',scheduledAt:new Date(Date.now()+86400000).toISOString(),location:'Controlled test',sourceAttribution:'E2E inbound'},cookie,csrfToken:token});expect(x.r.status===201,'consultation failed');
 x=await call('/api/orders',{method:'POST',body:{prospectId,status:'confirmed',description:'E2E test suit',quotedInr:100000,revenueInr:50000,orderedAt:new Date().toISOString()},cookie,csrfToken:token});expect(x.r.status===201,'order failed');
 const {rows:[sent]}=await pool.query("select count(*)::int n from aurum_acquisition.send_attempts where message_id=$1 and status='sent'",[messageId]);expect(sent.n===0,'a real send was recorded');
 console.log(JSON.stringify({ok:true,checks:14,providerInvoked:false,realSends:0}));
} finally {await cleanup();await pool.end();}
