/**
 * Cliente de R2 (vía Cloudflare Worker con presigned URLs)
 * Upload DIRECTO a R2 (sin proxy)
 */

const WORKER_URL = 'https://r2-ghost.jorgeugax.workers.dev';

/**
 * Sube archivo a R2 usando presigned URL (DIRECTO)
 */
export async function uploadToB2(blob, fileName, onProgress = null) {
  const key = `${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)}`;
  const contentType = blob.type || 'application/octet-stream';

  // Paso 1: Obtener presigned URL del Worker
  const signRes = await fetch(`${WORKER_URL}/sign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, contentType }),
  });

  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error || `Error obteniendo URL: HTTP ${signRes.status}`);
  }

  const { presignedUrl } = await signRes.json();

  // Paso 2: Upload DIRECTO a R2
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    // NO enviar Content-Type header - la presigned URL no lo incluye en la firma

    let startTime = Date.now();
    const speedSamples = [];
    const MAX_SAMPLES = 5;

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          if (elapsed > 1) {
            const instantSpeed = e.loaded / elapsed;
            speedSamples.push(instantSpeed);
            if (speedSamples.length > MAX_SAMPLES) speedSamples.shift();
            const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
            onProgress(e.loaded, e.total, avgSpeed, (e.total - e.loaded) / avgSpeed);
          } else {
            onProgress(e.loaded, e.total);
          }
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ key, size: blob.size });
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Error de red')));
    xhr.addEventListener('abort', () => reject(new Error('Cancelado')));
    xhr.timeout = 0; // Sin timeout
    xhr.send(blob);
  });

  return result;
}

/**
 * Descarga archivo desde R2
 */
export async function downloadFromB2(key, onProgress = null) {
  console.log(`📥 Iniciando descarga de R2: key=${key}`);
  
  const dlRes = await fetch(`${WORKER_URL}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  
  console.log(`📡 Respuesta del Worker: status=${dlRes.status}, ok=${dlRes.ok}`);
  
  if (!dlRes.ok) {
    const err = await dlRes.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${dlRes.status} al descargar`);
  }

  const contentLength = dlRes.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  console.log(`📊 Content-Length: ${total} bytes`);
  
  if (!dlRes.body) throw new Error('No se pudo obtener el stream');

  const reader = dlRes.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastTime = Date.now();
  const startTime = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const now = Date.now();
    if (now - lastTime > 250) {
      lastTime = now;
      if (onProgress) {
        const elapsed = (now - startTime) / 1000;
        onProgress(loaded, total, total ? Math.round((loaded / total) * 100) : 0, loaded / elapsed);
      }
    }
  }

  console.log(`✅ Descarga completa: ${loaded} bytes recibidos (esperados: ${total})`);
  
  if (total > 0 && loaded !== total) {
    console.warn(`⚠️ Tamaño no coincide: recibido=${loaded}, esperado=${total}`);
  }

  const contentType = dlRes.headers.get('content-type') || 'application/octet-stream';
  const blob = new Blob(chunks, { type: contentType });
  
  console.log(`📦 Blob creado: size=${blob.size}, type=${blob.type}`);
  
  return blob;
}

/**
 * Borra archivo de R2
 */
export async function deleteFromB2(key) {
  const res = await fetch(`${WORKER_URL}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error al borrar: HTTP ${res.status}`);
  }
}

/**
 * Verifica si el Worker R2 está disponible
 */
export async function testB2Connection() {
  try {
    const res = await fetch(`${WORKER_URL}/health`);
    if (res.ok) {
      const data = await res.json();
      return data.status === 'ok';
    }
    return false;
  } catch {
    return false;
  }
}
