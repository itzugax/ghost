/**
 * Cliente de Backblaze B2 para el navegador
 * Se comunica con el servidor proxy local o Vercel serverless
 */

// URL del servidor proxy - detectar automáticamente el entorno
const PROXY_URL = (() => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      // En desarrollo, usar proxy local
      return 'http://localhost:3001';
    } else {
      // En producción (Vercel), usar el mismo origin
      return origin;
    }
  }
  return window.location.origin; // Fallback para producción
})();

console.log('🔧 B2 Proxy URL (Producción):', PROXY_URL);

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
      console.log(`📤 Iniciando subida B2: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // 1. Verificar que el proxy esté disponible
      const isB2Available = await testB2Connection();
      if (!isB2Available) {
        throw new Error('Servidor B2 no disponible. Intenta con un archivo más pequeño (<50MB)');
      }
      
      // 2. Obtener URL firmada del proxy
      const key = `${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;
      
      console.log('🔑 Obteniendo URL firmada...');
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
        const errorText = await urlResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `HTTP ${urlResponse.status}: ${errorText}` };
        }
        throw new Error(errorData.error || `No se pudo obtener URL de subida: HTTP ${urlResponse.status}`);
      }
      
      const { uploadUrl } = await urlResponse.json();
      
      if (!uploadUrl) {
        throw new Error('URL de subida no recibida del servidor');
      }
      
      console.log('✅ URL firmada obtenida, iniciando subida directa a B2...');
      
      // 3. Subir DIRECTAMENTE a B2 con progreso real
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
          console.log('✅ Subida a B2 completada exitosamente');
          resolve({ key, size: blob.size });
        } else {
          let errorMsg = `HTTP ${xhr.status}: ${xhr.statusText}`;
          if (xhr.status === 413) {
            errorMsg = "Archivo demasiado grande para el servidor B2";
          } else if (xhr.status === 403) {
            errorMsg = "Acceso denegado al servidor B2. Verificar credenciales";
          } else if (xhr.status === 500) {
            errorMsg = "Error interno del servidor B2";
          } else if (xhr.status === 0) {
            errorMsg = "Error de red - no se pudo conectar a B2";
          }
          console.error('❌ Error en subida B2:', errorMsg);
          reject(new Error(errorMsg));
        }
      });
      
      xhr.addEventListener('error', () => {
        const errorMsg = 'Error de red al subir a B2. Verificar conexión';
        console.error('❌', errorMsg);
        reject(new Error(errorMsg));
      });
      
      xhr.addEventListener('abort', () => {
        const errorMsg = 'Subida cancelada por el usuario';
        console.warn('⚠️', errorMsg);
        reject(new Error(errorMsg));
      });
      
      xhr.addEventListener('timeout', () => {
        const errorMsg = 'Tiempo de espera agotado. Archivo muy grande o conexión lenta';
        console.error('⏰', errorMsg);
        reject(new Error(errorMsg));
      });
      
      // Timeout de 15 minutos para archivos muy grandes
      xhr.timeout = 15 * 60 * 1000;
      
      xhr.send(blob);
      
    } catch (error) {
      console.error('❌ Error en uploadToB2:', error);
      reject(error);
    }
  });
}

/**
 * Descarga archivo desde Backblaze B2 con progreso visual
 * @param {string} key - Clave del archivo en B2
 * @param {Function} onProgress - Callback para progreso (loaded, total, percent)
 * @returns {Promise<Blob>}
 */
export async function downloadFromB2(key, onProgress = null) {
  try {
    console.log(`📥 Descargando de B2: ${key}`);
    
    // Mostrar progreso de descarga
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
    
    // Obtener el tamaño del archivo si está disponible
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (!response.body) {
      throw new Error('No se pudo obtener el stream de descarga');
    }
    
    // Leer el stream con progreso
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    let lastProgressTime = Date.now();
    const startTime = Date.now();
    
    console.log(`📊 Descargando archivo de ${total ? formatBytes(total) : 'tamaño desconocido'}...`);
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      // Calcular progreso y velocidad
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const speed = loaded / elapsed;
      const percent = total ? Math.round((loaded / total) * 100) : 0;
      
      // Actualizar progreso cada 500ms o cada 1MB
      if (now - lastProgressTime > 500 || loaded % (1024 * 1024) < value.length) {
        lastProgressTime = now;
        
        // Callback para UI
        if (onProgress) {
          onProgress(loaded, total, percent, speed);
        }
        
        // Log detallado
        if (total) {
          const remaining = (total - loaded) / speed;
          console.log(`📥 Descarga B2: ${formatBytes(loaded)}/${formatBytes(total)} (${percent}%) - ${formatSpeed(speed)} - ETA: ${formatTime(remaining)}`);
        } else {
          console.log(`📥 Descarga B2: ${formatBytes(loaded)} - ${formatSpeed(speed)}`);
        }
      }
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    const avgSpeed = loaded / totalTime;
    console.log(`✅ Descarga B2 completada: ${formatBytes(loaded)} en ${totalTime.toFixed(1)}s (${formatSpeed(avgSpeed)} promedio)`);
    
    // Combinar todos los chunks en un blob
    const blob = new Blob(chunks);
    return blob;
    
  } catch (error) {
    console.error('❌ Error descargando de B2:', error);
    throw new Error(`No se pudo descargar el archivo de Backblaze B2: ${error.message}`);
  }
}

// Helper functions para formateo
function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + " B/s";
  if (bytesPerSecond < 1048576) return (bytesPerSecond / 1024).toFixed(1) + " KB/s";
  return (bytesPerSecond / 1048576).toFixed(1) + " MB/s";
}

function formatTime(seconds) {
  if (seconds < 60) return Math.ceil(seconds) + "s";
  if (seconds < 3600) return Math.ceil(seconds / 60) + "m";
  return Math.ceil(seconds / 3600) + "h";
}

// Helper function para formatear bytes (si no existe)
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
 * Verifica si el proxy B2 está disponible
 * @returns {Promise<boolean>}
 */
export async function testB2Connection() {
  try {
    console.log('🔍 Verificando conexión B2 en Vercel...');
    
    // En producción (Vercel), solo probar las rutas correctas
    const isProduction = !window.location.hostname.includes('localhost');
    
    const urls = isProduction 
      ? ['/health', '/api/health'] // Solo rutas de Vercel
      : ['/health', 'http://localhost:3001/health']; // Desarrollo
    
    for (const url of urls) {
      try {
        console.log(`🔍 Probando: ${url}`);
        const response = await fetch(url, { 
          method: 'GET',
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log(`📡 Respuesta de ${url}: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`📊 Datos recibidos:`, data);
          
          if (data.status === 'ok') {
            console.log('✅ B2 Proxy disponible en:', url);
            return true;
          }
        } else {
          console.warn(`⚠️ ${url} respondió con ${response.status}`);
        }
      } catch (e) {
        console.warn(`❌ Error en ${url}:`, e.message);
      }
    }
    
    console.warn('⚠️ B2 Proxy no disponible - archivos >50MB no funcionarán');
    return false;
  } catch (error) {
    console.error('❌ Error verificando B2:', error);
    return false;
  }
}
