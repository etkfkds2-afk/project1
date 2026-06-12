const JSON_HEADERS={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store'
};

async function ensureTable(db){
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
}

function getKey(url){
  return url.searchParams.get('key')||'payment_overrides';
}

export async function onRequestGet(context){
  const db=context.env.DB;
  if(!db)return json({error:'D1 binding DB is not configured'},500);
  await ensureTable(db);
  const key=getKey(new URL(context.request.url));
  const row=await db.prepare('SELECT value, updated_at FROM app_settings WHERE key = ?').bind(key).first();
  if(!row)return json({key,value:{},updated_at:null});
  try{
    return json({key,value:JSON.parse(row.value),updated_at:row.updated_at});
  }catch(e){
    return json({key,value:{},updated_at:row.updated_at,parseError:true});
  }
}

export async function onRequestPut(context){
  const db=context.env.DB;
  if(!db)return json({error:'D1 binding DB is not configured'},500);
  await ensureTable(db);
  let body;
  try{
    body=await context.request.json();
  }catch(e){
    return json({error:'Invalid JSON body'},400);
  }
  const key=String(body.key||'payment_overrides');
  const value=JSON.stringify(body.value&&typeof body.value==='object'?body.value:{});
  await db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(key,value).run();
  return json({ok:true,key});
}

export async function onRequestPost(context){
  return onRequestPut(context);
}
