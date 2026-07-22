import{json,requireSession,sameOrigin}from'../_lib/payment-auth.js';

const ALLOWED_KEYS=new Set(['payment_overrides','google_client_id','customer_contacts','reservation_hidden_ids','event_type_groups','event_type_overrides']);

async function ensureTable(db){
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function getKey(url){
  return url.searchParams.get('key')||'payment_overrides';
}

export async function onRequestGet(context){
  const auth=await requireSession(context);if(auth.response)return auth.response;
  const db=context.env.DB;
  if(!db)return json({error:'D1 binding DB is not configured'},500);
  await ensureTable(db);
  const key=getKey(new URL(context.request.url));
  if(!ALLOWED_KEYS.has(key))return json({error:'Invalid settings key'},400);
  const row=await db.prepare('SELECT value, updated_at FROM app_settings WHERE key = ?').bind(key).first();
  if(!row)return json({key,value:{},updated_at:null});
  try{
    return json({key,value:JSON.parse(row.value),updated_at:row.updated_at});
  }catch(e){
    return json({key,value:{},updated_at:row.updated_at,parseError:true});
  }
}

export async function onRequestPut(context){
  const auth=await requireSession(context);if(auth.response)return auth.response;
  if(!sameOrigin(context.request))return json({error:'Invalid origin'},403);
  const db=context.env.DB;
  if(!db)return json({error:'D1 binding DB is not configured'},500);
  await ensureTable(db);
  const length=Number(context.request.headers.get('Content-Length')||0);
  if(length>1048576)return json({error:'Request body too large'},413);
  let body;
  try{
    body=await context.request.json();
  }catch(e){
    return json({error:'Invalid JSON body'},400);
  }
  const key=String(body.key||'payment_overrides');
  if(!ALLOWED_KEYS.has(key))return json({error:'Invalid settings key'},400);
  const value=JSON.stringify(body.value&&typeof body.value==='object'?body.value:{});
  if(value.length>1048576)return json({error:'Settings value too large'},413);
  const expectedUpdatedAt=body.updated_at===undefined?undefined:body.updated_at;
  const current=await db.prepare('SELECT updated_at FROM app_settings WHERE key = ?').bind(key).first();
  const currentUpdatedAt=current?.updated_at||null;
  if(expectedUpdatedAt!==undefined&&expectedUpdatedAt!==currentUpdatedAt){
    return json({error:'Conflict',key,updated_at:currentUpdatedAt},409);
  }
  const updatedAt=new Date().toISOString();
  await db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).bind(key,value,updatedAt).run();
  return json({ok:true,key,updated_at:updatedAt});
}

export async function onRequestPost(context){
  return onRequestPut(context);
}
