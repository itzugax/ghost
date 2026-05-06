/**
 * Cliente de Backblaze B2 para el navegador
 * Se comunica con el servidor proxy local
 */

// URL del servidor proxy (en producción usa Vercel serverless routes)
const PROXY_URL = window.location.origin;

/**
 * Sube archivo a Backblaze B2 a través del proxy con progreso
 * @param {Blob} blob - Archivo cifrado
 * @param {string} fileName - Nombre del archivo
 * @param {Function} onProgress - Callback para progreso (loaded, total)
 * @returns {Promise<{key: string, size: number}>}
 */
/**
 * Sube archivo DIRECTAMENTE a Backblaze B2 usando URL firmada
 * @param {Blob} blob - Archivo cifrado
 * @param {string} fileName - Nombre del archivo
 * @param {Function} onProgress - Callback para progreso (loaded, total)
 * @returns {Promise<{key: string, size: number}>}
 */
export async function uploadToB2(blob, fileName, onProgress = null) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Obtener URL firmada del proxy
      const key = `${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;
      
      const urlResponse = await fetch(`${PROXY_URL}/get-upload-url`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Proxy-Token': localStorage.getItem('b2-proxy-token') || ''
        },
        body: JSON.stringify({ 
          key, 
          contentType: blob.type || 'application/octet-stream' 
        })
      });
      
      if (!urlResponse.ok) {
        const errorData = await urlResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${urlResponse.status}: No se pudo obtener URL de subida`);
      }
      
      const { uploadUrl } = await urlResponse.json();
      
      if (!uploadUrl) {
        throw new Error('URL de subida no recibida del servidor');
      }
      
      // 2. Subir DIRECTAMENTE a B2 con progreso real
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
      
      let startTime = Date.now();
      const speedSamples = [];
      const MAX_SAMPLES = 5;
      
      // Progreso REAL de subida a B2
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          
          // Solo calcular después de 1 segundo
          if (elapsed > 1) {
            const instantSpeed = e.loaded / elapsed;
            speedSamples.push(instantSpeed);
            
            if (speedSamples.length > MAX_SAMPLES) {
              speedSamples.shift();
            }
            
            const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
            const remaining = (e.total - e.loaded) / avgSpeed;
            
            onProgress(e.loaded, e.total, avgSpeed, remaining);
          } else {
            // Primeros segundos: solo bytes
            onProgress(e.loaded, e.total);
          }
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ key, size: blob.size });
        } else {
          let errorMsg = `HTTP ${xhr.status}: ${xhr.statusText}`;
          if (xhr.status === 413) {
            errorMsg = "Archivo demasiado grande para el servidor";
          } else if (xhr.status === 403) {
            errorMsg = "Acceso denegado al servidor de archivos";
          } else if (xhr.status === 500) {
            errorMsg = "Error interno del servidor de archivos";
          }
          reject(new Error(errorMsg));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Error de red al subir a B2'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Subida cancelada'));
      });
      
      xhr.addEventListener('timeout', () => {
        reject(new Error('Tiempo de espera agotado'));
      });
      
      // Timeout de 10 minutos para archivos grandes
      xhr.timeout = 10 * 60 * 1000;
      
      xhr.send(blob);
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Descarga archivo desde Backblaze B2
 * @param {string} key - Clave del archivo en B2
 * @returns {Promise<Blob>}
 */
export async function downloadFromB2(key) {
  try {
    const response = await fetch(`${PROXY_URL}/download/${encodeURIComponent(key)}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error || `HTTP ${response.status}`;
      } catch {
        errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMsg);
    }
    
    const blob = await response.blob();
    return blob;
  } catch (error) {
    throw new Error(`No se pudo descargar el archivo de Backblaze B2: ${error.message}`);
  }
}

/**
 * Borra archivo de Backblaze B2
 * @param {string} key - Clave del archivo en B2
 */
export async function deleteFromB2(key) {
  try {
    const response = await fetch(`${PROXY_URL}/delete/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Error borrando archivo');
    }
  } catch (error) {
    // No lanzar error, el archivo expirará de todas formas
  }
}

/**
 * Verifica si el proxy está disponible
 * @returns {Promise<boolean>}
 */
export async function testB2Connection() {
  try {
    const response = await fetch(`${PROXY_URL}/health`);
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    return false;
  }
}
