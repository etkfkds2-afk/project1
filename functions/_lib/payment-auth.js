const SESSION_COOKIE='atm_payment_session';
const SESSION_DAYS=7;
const ACCESS_USER='boss';
const ACCESS_HASH='585821c6e0290e4ad6f01a88007d4c05875a0d59ffc50bd9bf95499d654c353c';

export const RESERVATION_BASES={
  munrae:'https://www.allthatmind.com/_functions',
  sinnonhyeon:'https://allthatmind2.wixsite.com/website/_functions'
};

export function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    ...headers
  }});
}

export async function sha256(text){
  const bytes=new TextEncoder().encode(String(text||''));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return[...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function ensureAuthTables(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS payment_sessions (
    token_hash TEXT PRIMARY KEY,
    reservation_token TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

function cookieValue(request,name){
  const cookie=request.headers.get('Cookie')||'';
  for(const part of cookie.split(';')){
    const [key,...rest]=part.trim().split('=');
    if(key===name)return decodeURIComponent(rest.join('='));
  }
  return'';
}

export async function createSession(db,reservationToken=null){
  await ensureAuthTables(db);
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const tokenHash=await sha256(token);
  const expires=new Date(Date.now()+SESSION_DAYS*86400000);
  await db.prepare('INSERT INTO payment_sessions (token_hash,reservation_token,expires_at) VALUES (?,?,?)')
    .bind(tokenHash,reservationToken,expires.toISOString()).run();
  return{token,cookie:`${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS*86400}`};
}

export async function getSession(context){
  const db=context.env.DB;
  if(!db)return null;
  const token=cookieValue(context.request,SESSION_COOKIE);
  if(!token)return null;
  await ensureAuthTables(db);
  const tokenHash=await sha256(token);
  const row=await db.prepare('SELECT reservation_token,expires_at FROM payment_sessions WHERE token_hash = ?').bind(tokenHash).first();
  if(!row||Date.parse(row.expires_at)<=Date.now()){
    if(row)await db.prepare('DELETE FROM payment_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return{tokenHash,reservationToken:row.reservation_token||null};
}

export async function requireSession(context){
  const session=await getSession(context);
  return session?{session}:{response:json({error:'Authentication required'},401)};
}

export function sameOrigin(request){
  const origin=request.headers.get('Origin');
  if(!origin)return true;
  try{return new URL(origin).host===new URL(request.url).host}catch(e){return false}
}

export async function validAdmin(username,password){
  if(String(username||'').trim()!==ACCESS_USER)return false;
  return(await sha256(password))===ACCESS_HASH;
}

export async function validateReservationToken(token){
  if(!token)return false;
  try{
    const response=await fetch(`${RESERVATION_BASES.munrae}/reservations`,{
      headers:{Authorization:`Bearer ${token}`}
    });
    return response.ok;
  }catch(e){return false}
}

export async function storedReservationToken(db){
  const row=await db.prepare('SELECT value FROM app_settings WHERE key = ?').bind('reservation_api_token').first();
  if(!row)return'';
  try{return String(JSON.parse(row.value)?.token||'').trim()}catch(e){return''}
}
