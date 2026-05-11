/**
 * Cloudflare Worker — Proxy de descargas B2 con caché edge
 *
 * Usa la API nativa de B2 (no S3) para autenticación simple con Basic Auth.
 * Las descargas se cachean en Cloudflare edge para minimizar el ancho de banda de B2.
 *
 * Se beneficia de la Bandwidth Alliance (B2 → Cloudflare es gratis, sin límite de 1GB/día)
 *
 * Variables de entorno requeridas:
 *   B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME
 * Opcional:
 *   VERCEL_ORIGIN — para proxy de /get-upload-url hacia el serverless de Vercel
 */

const B2_API = 'https://api.backblazeb2.com/b2api/v2';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Token, X-File-Name',
    'Access-Control-Max-Age': '86400',
  };
}

async function b2Authorize(env) {
  const cred = btoa(`${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`);
  const res = await fetch(`${B2_API}/b2_authorize_account`, {
    headers: { Authorization: `Basic ${cred}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2 auth failed (${res.status}): ${text}`);
  }
  return res.json();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const path = url.pathname;

    try {
      // ── Health ──────────────────────────────────────────
      if (path === '/health') {
        let b2Status = 'disconnected';
        let b2Info = null;
        try {
          b2Info = await b2Authorize(env);
          b2Status = 'ok';
        } catch (e) {
          b2Status = `error: ${e.message}`;
        }

        return new Response(JSON.stringify({
          status: b2Status === 'ok' ? 'ok' : 'warning',
          service: 'b2-proxy-worker',
          bucket: env.B2_BUCKET_NAME || 'NOT_CONFIGURED',
          keyId: env.B2_KEY_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
          appKey: env.B2_APPLICATION_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
          b2Status,
          bandwidthAlliance: true,
          cacheEnabled: true,
        }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // ── Subir archivo a B2 (proxy a Vercel + presigned URL S3) ──
      if (path === '/upload' && request.method === 'POST') {
        if (!env.VERCEL_ORIGIN) {
          return new Response(JSON.stringify({ error: 'VERCEL_ORIGIN not configured in Worker' }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        const rawName = request.headers.get('X-File-Name') || 'file';
        const fileName = rawName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
        const key = `${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName}`;
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

        // Obtener presigned URL de Vercel (usa S3 SDK, funciona con keys S3-only)
        const urlRes = await fetch(`${env.VERCEL_ORIGIN}/get-upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, contentType }),
        });
        if (!urlRes.ok) {
          const text = await urlRes.text();
          return new Response(JSON.stringify({ error: `Failed to get upload URL: ${text}` }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        const { uploadUrl } = await urlRes.json();

        // Reenviar archivo a B2 usando la presigned URL (server-to-server, sin CORS)
        const b2Res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: request.body,
        });

        if (!b2Res.ok) {
          const text = await b2Res.text();
          return new Response(JSON.stringify({ error: `B2 upload failed (${b2Res.status})` }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, key, size: 0 }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // ── Obtener URL de subida (proxy a Vercel) ─────────
      if (path === '/get-upload-url' && request.method === 'POST') {
        if (!env.VERCEL_ORIGIN) {
          return new Response(JSON.stringify({ error: 'VERCEL_ORIGIN not configured in Worker' }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        const vercelRes = await fetch(`${env.VERCEL_ORIGIN}/get-upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: await request.text(),
        });

        const data = await vercelRes.json();
        return new Response(JSON.stringify(data), {
          status: vercelRes.status,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // ── Descargar archivo (con caché edge) ─────────────
      const downloadMatch = path.match(/^\/download\/(.+)$/);
      if (downloadMatch) {
        const fileKey = decodeURIComponent(downloadMatch[1]);

        // Intentar servir desde caché
        const cacheKey = new Request(url.toString(), request);
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          const headers = new Headers(cached.headers);
          Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
          return new Response(cached.body, {
            status: cached.status,
            headers,
          });
        }

        // Autenticar con B2
        const auth = await b2Authorize(env);

        // Descargar desde B2 (Bandwidth Alliance: este tráfico es gratis)
        const b2Url = `${auth.downloadUrl}/file/${env.B2_BUCKET_NAME}/${fileKey}`;
        const b2Res = await fetch(b2Url, {
          headers: { Authorization: auth.authorizationToken },
        });

        if (!b2Res.ok) {
          const text = await b2Res.text();
          return new Response(JSON.stringify({
            error: `B2 download failed (${b2Res.status})`,
            details: text,
          }), {
            status: b2Res.status,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        // Cachear en Cloudflare edge (el archivo expira en ~15min, cache 1h)
        const cacheHeaders = new Headers(b2Res.headers);
        cacheHeaders.set('Cache-Control', 'public, max-age=3600');
        Object.entries(cors).forEach(([k, v]) => cacheHeaders.set(k, v));
        cacheHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

        const cacheResponse = new Response(b2Res.body, {
          status: b2Res.status,
          headers: cacheHeaders,
        });

        ctx.waitUntil(caches.default.put(cacheKey, cacheResponse.clone()));

        return cacheResponse;
      }

      // ── Borrar archivo (proxy a Vercel) ────────────────
      const deleteMatch = path.match(/^\/delete\/(.+)$/);
      if (deleteMatch && request.method === 'DELETE') {
        if (!env.VERCEL_ORIGIN) {
          return new Response(JSON.stringify({ error: 'VERCEL_ORIGIN not configured' }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        const vercelRes = await fetch(`${env.VERCEL_ORIGIN}/delete/${deleteMatch[1]}`, {
          method: 'DELETE',
        });
        const data = await vercelRes.json();
        return new Response(JSON.stringify(data), {
          status: vercelRes.status,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
