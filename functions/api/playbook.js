var accessKeysPromise;

function json(body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}
  });
}

function decodeBase64Url(value){
  var base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  base64 += '='.repeat((4 - (base64.length % 4)) % 4);
  var raw = atob(base64), bytes = new Uint8Array(raw.length);
  for(var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function parseJsonPart(value){
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getAccessIdentity(request, env){
  var token = request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
  var parts = token.split('.');
  if(parts.length !== 3) return null;

  try{
    var header = parseJsonPart(parts[0]);
    var claims = parseJsonPart(parts[1]);
    var audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if(!header.kid || !claims.email || !claims.exp || claims.exp * 1000 < Date.now() || audiences.indexOf(env.CF_ACCESS_AUD) === -1) return null;

    if(!accessKeysPromise){
      accessKeysPromise = fetch('https://' + env.CF_ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs')
        .then(function(res){ if(!res.ok) throw new Error('Could not load Access certificates'); return res.json(); })
        .then(function(data){ return data.keys || []; });
    }
    var keys = await accessKeysPromise;
    var jwk = keys.filter(function(key){ return key.kid === header.kid; })[0];
    if(!jwk) return null;
    var publicKey = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
    var signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    var valid = await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'}, publicKey, decodeBase64Url(parts[2]), signed);
    return valid ? {email:claims.email.toLowerCase()} : null;
  }catch(e){
    return null;
  }
}

function isAdmin(identity, env){
  var allowed = String(env.ADMIN_EMAILS || '').split(',').map(function(email){ return email.trim().toLowerCase(); });
  return !!identity && allowed.indexOf(identity.email) !== -1;
}

export async function onRequestGet(context){
  var identity = await getAccessIdentity(context.request, context.env);
  if(!identity) return json({error:'Cloudflare Access login is required.'}, 401);
  var row = await context.env.DB.prepare('SELECT payload, updated_at FROM playbook WHERE id = 1').first();
  if(!row) return json({sections:[], updated:null, canEdit:isAdmin(identity, context.env), viewer:identity.email});
  var data = JSON.parse(row.payload);
  data.updated = row.updated_at;
  data.canEdit = isAdmin(identity, context.env);
  data.viewer = identity.email;
  return json(data);
}

export async function onRequestPost(context){
  var identity = await getAccessIdentity(context.request, context.env);
  if(!identity) return json({error:'Cloudflare Access login is required.'}, 401);
  if(!isAdmin(identity, context.env)) return json({error:'Your account is not an administrator.'}, 403);

  try{
    var data = await context.request.json();
    if(!data || !Array.isArray(data.sections) || !data.sections.length) return json({error:'Invalid playbook data.'}, 400);
    var payload = JSON.stringify({sections:data.sections});
    var updated = new Date().toISOString();
    await context.env.DB.prepare(
      'INSERT INTO playbook (id, payload, updated_at, updated_by) VALUES (1, ?1, ?2, ?3) '
      + 'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at, updated_by = excluded.updated_by'
    ).bind(payload, updated, identity.email).run();
    return json({updated:updated, viewer:identity.email});
  }catch(e){
    return json({error:'Unable to save playbook data.'}, 400);
  }
}
