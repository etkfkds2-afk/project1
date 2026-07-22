import{createSession,getSession,json,sameOrigin,validAdmin,validateReservationToken}from'../_lib/payment-auth.js';

export async function onRequestGet(context){
  if(!context.env.DB)return json({error:'D1 binding DB is not configured'},500);
  const session=await getSession(context);
  return session?json({authenticated:true}):json({authenticated:false},401);
}

export async function onRequestPost(context){
  if(!context.env.DB)return json({error:'D1 binding DB is not configured'},500);
  if(!sameOrigin(context.request))return json({error:'Invalid origin'},403);
  let body;
  try{body=await context.request.json()}catch(e){return json({error:'Invalid JSON body'},400)}
  const password=String(body.password||'');
  const admin=await validAdmin(body.username,password);
  const reservationLogin=admin?false:await validateReservationToken(password);
  if(!admin&&!reservationLogin)return json({error:'Invalid credentials'},401);
  const session=await createSession(context.env.DB,reservationLogin?password:null);
  return json({authenticated:true,reservationLogin},200,{'Set-Cookie':session.cookie});
}

export async function onRequestDelete(context){
  if(!sameOrigin(context.request))return json({error:'Invalid origin'},403);
  const session=await getSession(context);
  if(session)await context.env.DB.prepare('DELETE FROM payment_sessions WHERE token_hash = ?').bind(session.tokenHash).run();
  return json({ok:true},200,{'Set-Cookie':'atm_payment_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
}
