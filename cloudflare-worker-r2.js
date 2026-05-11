/**
 * Cloudflare Worker — R2 presigned URL generator
 *
 * Genera URLs firmadas (AWS SigV4) para upload/download directo a R2.
 * El browser nunca necesita las credenciales — solo URLs temporales.
 *
 * Endpoints:
 *   POST /upload?key=xxx → Proxy de subida (Worker recibe, reenvía a R2 con CORS)
 *   POST /download       → Stream del objeto con CORS (proxy)
 *   POST /delete         → Worker hace DELETE directo (no browser)
 *   GET  /setup-cors     → Configura CORS en el bucket R2 (llamar una vez)
 *   GET  /health         → Health check
 *
 * Variables de entorno requeridas:
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET
 */

const R2_REGION = 'auto';
const R2_SERVICE = 's3';

async function hmac(key, data) {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256(str) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)));
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key, dateStamp) {
  const kDate = await hmac('AWS4' + key, dateStamp);
  const kRegion = await hmac(kDate, R2_REGION);
  const kService = await hmac(kRegion, R2_SERVICE);
  return await hmac(kService, 'aws4_request');
}

async function presignUrl({ method, path, contentType, expiresIn, accessKeyId, secretAccessKey, accountId, bucket }) {
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = dateStamp + 'T' + now.toISOString().slice(11, 19).replace(/:/g, '') + 'Z';

  const credential = `${accessKeyId}/${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;

  // Para presigned URLs, solo firmamos 'host' (no content-type)
  const signedHeaders = 'host';
  const canonicalHeaders = `host:${host}\n`;

  const payloadHash = 'UNSIGNED-PAYLOAD';

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  };

  const canonicalQuery = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');

  const canonicalRequest = `${method}\n/${path}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp);
  const signature = toHex(await hmac(signingKey, stringToSign));

  return `https://${host}/${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function signedR2Fetch(method, pathQuery, body, env) {
  const host = `${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = dateStamp + 'T' + now.toISOString().slice(11, 19).replace(/:/g, '') + 'Z';

  const [uri, qs] = pathQuery.includes('?') ? pathQuery.split('?') : [pathQuery, ''];
  const canonicalUri = '/' + uri;
  // Normalize query string: for 'cors' (no value), it becomes 'cors='
  const canonicalQs = qs ? qs.split('&').map(p => {
    const [k, v] = p.includes('=') ? p.split('=') : [p, ''];
    return encodeURIComponent(k) + '=' + encodeURIComponent(v);
  }).join('&') : '';

  const bodyHash = body ? await sha256(body) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQs}\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;

  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signingKey = await getSignatureKey(env.R2_SECRET_ACCESS_KEY, dateStamp);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${host}/${uri}${canonicalQs ? '?' + canonicalQs : ''}`, {
    method,
    headers: {
      'Host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': amzDate,
      'Authorization': authHeader,
      ...(body ? { 'Content-Type': 'application/xml' } : {}),
    },
    body: body || undefined,
  });
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors });

    const path = url.pathname;

    try {
      if (path === '/' || path === '/health') {
        return new Response(JSON.stringify({
          status: 'ok', service: 'r2-presigner',
          bucket: env.R2_BUCKET || 'NOT_CONFIGURED',
          account: env.R2_ACCOUNT_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
          keyId: env.R2_ACCESS_KEY_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
        }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (path === '/setup-cors') {
        const corsXml = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

        const res = await signedR2Fetch('PUT', '?cors', corsXml, env);

        if (!res.ok) {
          const text = await res.text();
          return new Response(JSON.stringify({ error: 'CORS setup failed', status: res.status, details: text }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, message: 'CORS configured on R2 bucket' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/sign-upload' && request.method === 'POST') {
        const { key, contentType } = await request.json();
        if (!key) return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

        const presignedUrl = await presignUrl({
          method: 'PUT', path: key,
          contentType: contentType || 'application/octet-stream',
          expiresIn: 3600,
          accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          accountId: env.R2_ACCOUNT_ID, bucket: env.R2_BUCKET,
        });

        return new Response(JSON.stringify({ presignedUrl, key }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (path === '/sign-download' && request.method === 'POST') {
        const { key } = await request.json();
        if (!key) return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

        const presignedUrl = await presignUrl({
          method: 'GET', path: key, expiresIn: 3600,
          accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          accountId: env.R2_ACCOUNT_ID, bucket: env.R2_BUCKET,
        });

        return new Response(JSON.stringify({ presignedUrl, key }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (path === '/delete' && request.method === 'POST') {
        const { key } = await request.json();
        if (!key) return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

        const delRes = await signedR2Fetch('DELETE', key, null, env);

        return new Response(JSON.stringify({ success: delRes.ok }), {
          status: delRes.ok ? 200 : 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/upload' && request.method === 'POST') {
        const key = url.searchParams.get('key');
        if (!key) return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

        const presignedUrl = await presignUrl({
          method: 'PUT', path: key, contentType, expiresIn: 3600,
          accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          accountId: env.R2_ACCOUNT_ID, bucket: env.R2_BUCKET,
        });

        const r2Res = await fetch(presignedUrl, { method: 'PUT', body: request.body, headers: { 'Content-Type': contentType } });

        if (!r2Res.ok) {
          return new Response(JSON.stringify({ error: 'Upload failed', status: r2Res.status }), {
            status: r2Res.status, headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ key }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/download' && request.method === 'POST') {
        const { key } = await request.json();
        if (!key) return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

        const presignedUrl = await presignUrl({
          method: 'GET', path: key, expiresIn: 3600,
          accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          accountId: env.R2_ACCOUNT_ID, bucket: env.R2_BUCKET,
        });

        const objRes = await fetch(presignedUrl);
        if (!objRes.ok) {
          return new Response(JSON.stringify({ error: 'Object not found', status: objRes.status }), {
            status: objRes.status, headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        const headers = new Headers(cors);
        headers.set('Content-Type', objRes.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Content-Length', objRes.headers.get('Content-Length') || '');
        headers.set('Cache-Control', 'public, max-age=31536000');

        return new Response(objRes.body, { headers });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  },
};
