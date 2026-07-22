import{json,requireSession,RESERVATION_BASES,sameOrigin,storedReservationToken,validateReservationToken}from'../_lib/payment-auth.js';

async function ensureSettings(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

function branchBase(branch){return RESERVATION_BASES[branch]||null}
async function sessionToken(context,session){
  if(session.reservationToken)return session.reservationToken;
  await ensureSettings(context.env.DB);
  return storedReservationToken(context.env.DB);
}
function forward(response){
  return new Response(response.body,{status:response.status,headers:{
    'Content-Type':response.headers.get('Content-Type')||'application/json; charset=utf-8',
    'Cache-Control':'no-store'
  }});
}

export async function onRequestGet(context){
  const auth=await requireSession(context);if(auth.response)return auth.response;
  const branch=new URL(context.request.url).searchParams.get('branch');
  const base=branchBase(branch);if(!base)return json({error:'Invalid branch'},400);
  const token=await sessionToken(context,auth.session);if(!token)return json({error:'Reservation token is not configured'},409);
  try{return forward(await fetch(`${base}/reservations`,{headers:{Authorization:`Bearer ${token}`}}))}
  catch(e){return json({error:'Reservation service unavailable'},502)}
}

export async function onRequestPost(context){
  const auth=await requireSession(context);if(auth.response)return auth.response;
  if(!sameOrigin(context.request))return json({error:'Invalid origin'},403);
  const length=Number(context.request.headers.get('Content-Length')||0);
  if(length>262144)return json({error:'Request body too large'},413);
  let body;try{body=await context.request.json()}catch(e){return json({error:'Invalid JSON body'},400)}
  if(body.action==='configureToken'){
    const token=String(body.token||'').trim();
    if(!await validateReservationToken(token))return json({error:'Invalid reservation token'},401);
    await ensureSettings(context.env.DB);
    const updatedAt=new Date().toISOString();
    await context.env.DB.prepare(`INSERT INTO app_settings (key,value,updated_at) VALUES (?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
      .bind('reservation_api_token',JSON.stringify({token}),updatedAt).run();
    return json({ok:true});
  }
  const base=branchBase(body.branch);if(!base)return json({error:'Invalid branch'},400);
  const allowed=new Set(['createReservation','reservations','confirmDeposit','confirmFullyPaid']);
  if(!allowed.has(body.endpoint))return json({error:'Invalid reservation action'},400);
  const token=await sessionToken(context,auth.session);if(!token)return json({error:'Reservation token is not configured'},409);
  try{return forward(await fetch(`${base}/${body.endpoint}`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body.payload||{})
  }))}catch(e){return json({error:'Reservation service unavailable'},502)}
}
