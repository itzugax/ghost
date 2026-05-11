/**
 * Servidor proxy para Backblaze B2
 * Permite subir archivos grandes desde el navegador
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config({ path: '.env.local' });

// Validar configuración crítica
const requiredEnvVars = {
  B2_KEY_ID: process.env.B2_KEY_ID,
  B2_APPLICATION_KEY: process.env.B2_APPLICATION_KEY,
  B2_BUCKET_NAME: process.env.B2_BUCKET_NAME,
  B2_ENDPOINT: process.env.B2_ENDPOINT
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes para B2:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('📝 Configura estas variables en Vercel Dashboard > Settings > Environment Variables');
}

const app = express();
const PORT = process.env.B2_PROXY_PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MAX_UPLOAD_MB = Number(process.env.B2_MAX_UPLOAD_MB || 500);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = Number(process.env.B2_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.B2_RATE_LIMIT_MAX_REQUESTS || 120);
const SERVER_TOKEN = process.env.B2_PROXY_TOKEN || '';
const ALLOW_SETUP_CORS = String(process.env.B2_ALLOW_SETUP_CORS || '').toLowerCase() === 'true';
const allowedOrigins = (process.env.B2_ALLOWED_ORIGINS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const rateLimitStore = new Map();

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function isValidStorageKey(key) {
  return typeof key === 'string' && /^[A-Za-z0-9/_\-.]{1,300}$/.test(key);
}

function authMiddleware(req, res, next) {
  // En producción (Vercel), no requerir token para simplificar
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return next();
  }
  
  // Solo en desarrollo local requerir token si está configurado
  if (!SERVER_TOKEN) return next();
  const token = req.headers['x-proxy-token'];
  if (token !== SERVER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function rateLimitMiddleware(req, res, next) {
  const now = Date.now();
  const ip = getClientIp(req);
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  return next();
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(rateLimitMiddleware);
app.use(authMiddleware);

// CORS más permisivo para descargas
app.use(cors({
  origin(origin, callback) {
    // Siempre permitir requests sin origin (como fetch directo)
    if (!origin) return callback(null, true);
    
    // En desarrollo, permitir todo
    if (!IS_PRODUCTION) return callback(null, true);
    
    // En producción, si no hay origins configurados, permitir todo
    if (allowedOrigins.length === 0) {
      console.log('⚠️ No hay B2_ALLOWED_ORIGINS configurado, permitiendo todos los orígenes');
      return callback(null, true);
    }
    
    // Si hay origins configurados, verificar
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn(`❌ Origin bloqueado por CORS: ${origin}`);
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Proxy-Token'],
  credentials: false
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Middleware para manejar errores de multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: `Archivo demasiado grande. Máximo: ${MAX_UPLOAD_MB}MB` 
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Archivo no esperado' 
      });
    }
    return res.status(400).json({ 
      error: `Error de archivo: ${error.message}` 
    });
  }
  
  if (error && /CORS/i.test(error.message || '')) {
    return res.status(403).json({ error: 'Origin blocked by CORS policy' });
  }
  
  console.error('Unhandled error:', error);
  return res.status(500).json({ 
    error: 'Error interno del servidor',
    details: IS_PRODUCTION ? undefined : error.message
  });
});

// Configurar multer para archivos grandes (por defecto 500MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    fieldSize: MAX_UPLOAD_BYTES
  },
  fileFilter: (req, file, cb) => {
    // Validar tipo de archivo básico
    if (!file.originalname || file.originalname.length > 255) {
      return cb(new Error('Nombre de archivo inválido'));
    }
    cb(null, true);
  }
});

// Cliente S3 para Backblaze B2
let s3Client = null;

try {
  if (process.env.B2_KEY_ID && process.env.B2_APPLICATION_KEY && process.env.B2_ENDPOINT) {
    s3Client = new S3Client({
      endpoint: `https://${process.env.B2_ENDPOINT}`,
      region: 'us-east-005',
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY
      }
    });
    console.log('✅ Cliente S3/B2 inicializado correctamente');
  } else {
    console.error('❌ No se pudo inicializar cliente S3/B2 - credenciales faltantes');
  }
} catch (error) {
  console.error('❌ Error inicializando cliente S3/B2:', error.message);
}

// Health check
app.get('/health', (req, res) => {
  const config = {
    status: 'ok', 
    service: 'b2-proxy',
    environment: process.env.NODE_ENV || 'development',
    vercel: !!process.env.VERCEL,
    bucket: process.env.B2_BUCKET_NAME || 'NOT_CONFIGURED',
    endpoint: process.env.B2_ENDPOINT || 'NOT_CONFIGURED',
    keyId: process.env.B2_KEY_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
    appKey: process.env.B2_APPLICATION_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
    s3ClientReady: !!s3Client,
    timestamp: new Date().toISOString(),
    authRequired: !process.env.VERCEL && !!SERVER_TOKEN
  };
  
  console.log('🏥 Health check:', config);
  
  // Si las credenciales no están configuradas, devolver warning pero no error
  if (!s3Client) {
    config.status = 'warning';
    config.message = 'B2 credentials not configured - large files disabled';
  }
  
  res.json(config);
});

// Endpoint para configurar CORS en B2 via S3 API
app.post('/setup-cors', async (req, res) => {
  if (!ALLOW_SETUP_CORS) {
    return res.status(403).json({ error: 'Endpoint disabled in this environment' });
  }
  try {
    const { PutBucketCorsCommand } = await import('@aws-sdk/client-s3');
    
    const corsRules = {
      CORSRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedOrigins: allowedOrigins.length ? allowedOrigins : ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600
        }
      ]
    };
    
    const command = new PutBucketCorsCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      CORSConfiguration: corsRules
    });
    
    await s3Client.send(command);
    
    console.log('✅ CORS configurado en B2');
    res.json({ success: true, message: 'CORS configurado correctamente' });
    
  } catch (error) {
    console.error('❌ Error configurando CORS:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para configurar CORS via B2 NATIVE API (cuando S3 PutBucketCors falla)
app.post('/setup-cors-native', async (req, res) => {
  if (!ALLOW_SETUP_CORS) {
    return res.status(403).json({ error: 'Endpoint disabled in this environment' });
  }
  try {
    // 1. Autenticar con B2 Native API
    const cred = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`).toString('base64');
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { 'Authorization': `Basic ${cred}` },
    });
    if (!authRes.ok) {
      const err = await authRes.text();
      throw new Error(`B2 auth failed: ${err}`);
    }
    const auth = await authRes.json();
    const apiUrl = auth.apiUrl + '/b2api/v2';

    // 2. Obtener accountId y bucketId desde la respuesta de auth
    const accountId = auth.accountId;
    const bucketId = auth.allowed?.bucketId;
    if (!accountId) throw new Error('No accountId in auth response');
    if (!bucketId) throw new Error('No bucketId in auth response. Key may not be scoped to a bucket.');

    // 3. Preparar regla CORS con S3 operations incluidas
    const newRule = {
      corsRuleName: 'ghost-drop-cors',
      allowedOrigins: ['*'],
      allowedHeaders: ['*'],
      allowedOperations: [
        'b2_download_file_by_id',
        'b2_download_file_by_name',
        'b2_upload_file',
        'b2_upload_part',
        's3_head',
        's3_get',
        's3_put',
        's3_delete',
      ],
      maxAgeSeconds: 3600,
    };

    // 4. Actualizar bucket con las reglas CORS (Sobreescribe las reglas existentes)
    const updateRes = await fetch(`${apiUrl}/b2_update_bucket`, {
      method: 'POST',
      headers: { 'Authorization': auth.authorizationToken },
      body: JSON.stringify({
        accountId,
        bucketId,
        corsRules: [newRule],
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      let errMsg = `B2 update failed`;
      try { const e = JSON.parse(errText); errMsg = e.message || e.code || errText; } catch {}
      throw new Error(errMsg);
    }

    const result = await updateRes.json();
    console.log('✅ CORS configurado via Native API');
    res.json({ 
      success: true, 
      message: 'CORS configurado via B2 Native API',
      corsRules: result.corsRules,
    });

  } catch (error) {
    console.error('❌ Error configurando CORS (native):', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para LIMPIAR todas las reglas CORS nativas de B2
// Necesario para poder usar S3 PutBucketCors (los dos sistemas son incompatibles)
app.post('/setup-cors-clear-native', async (req, res) => {
  if (!ALLOW_SETUP_CORS) {
    return res.status(403).json({ error: 'Endpoint disabled in this environment' });
  }
  try {
    const cred = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`).toString('base64');
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { 'Authorization': `Basic ${cred}` },
    });
    if (!authRes.ok) {
      const err = await authRes.text();
      throw new Error(`B2 auth failed: ${err}`);
    }
    const auth = await authRes.json();
    const apiUrl = auth.apiUrl + '/b2api/v2';
    const accountId = auth.accountId;
    const bucketId = auth.allowed?.bucketId;
    if (!accountId) throw new Error('No accountId in auth response');
    if (!bucketId) throw new Error('No bucketId in auth response');

    const updateRes = await fetch(`${apiUrl}/b2_update_bucket`, {
      method: 'POST',
      headers: { 'Authorization': auth.authorizationToken },
      body: JSON.stringify({
        accountId,
        bucketId,
        corsRules: [],
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      let errMsg = 'B2 update failed';
      try { const e = JSON.parse(errText); errMsg = e.message || e.code || errText; } catch {}
      throw new Error(errMsg);
    }

    const result = await updateRes.json();
    console.log('✅ Reglas CORS nativas eliminadas');
    res.json({
      success: true,
      message: 'Todas las reglas CORS nativas eliminadas. Ahora puedes usar /setup-cors (S3).',
      corsRules: result.corsRules,
    });

  } catch (error) {
    console.error('❌ Error limpiando CORS nativo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener URL firmada de subida
app.post('/get-upload-url', async (req, res) => {
  try {
    if (!s3Client) {
      return res.status(503).json({ 
        error: 'Servicio B2 no configurado. Variables de entorno faltantes.' 
      });
    }

    const { key, contentType } = req.body;
    
    if (!isValidStorageKey(key)) {
      return res.status(400).json({ error: 'Invalid key format' });
    }
    
    console.log(`🔑 Generando URL de subida para: ${key}`);
    
    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'application/octet-stream'
    });
    
    // Generar URL firmada válida por 1 hora
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    console.log(`✅ URL de subida generada`);
    
    res.json({ uploadUrl, key });
    
  } catch (error) {
    console.error('❌ Error generando URL:', error);
    res.status(500).json({
      error: error.message || 'Error generando URL de subida',
      details: IS_PRODUCTION ? undefined : error.stack
    });
  }
});

// Endpoint para subir archivo a B2 con progreso real
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (req.file.size > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: `File too large. Maximum: ${MAX_UPLOAD_MB}MB` });
    }

    const originalName = (req.body.fileName || req.file.originalname || 'file.bin')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .slice(0, 120);
    const key = `${Date.now()}_${Math.random().toString(36).slice(2)}_${originalName}`;

    console.log(`📤 Subiendo ${originalName} (${(req.file.size / 1024 / 1024).toFixed(2)} MB) a B2...`);

    // Configurar headers para streaming de progreso
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || 'application/octet-stream',
      Metadata: {
        'original-name': originalName,
        'upload-time': new Date().toISOString()
      }
    });

    // Subir a B2 (esto toma tiempo)
    await s3Client.send(command);

    console.log(`✅ Archivo subido a B2. Key: ${key}`);

    // Enviar respuesta final
    res.json({
      success: true,
      key,
      size: req.file.size
    });

  } catch (error) {
    console.error('❌ Error subiendo a B2:', error);
    
    let statusCode = 500;
    let errorMessage = 'Error subiendo archivo';
    
    if (error.name === 'PayloadTooLargeError' || error.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      errorMessage = `Archivo demasiado grande. Máximo: ${MAX_UPLOAD_MB}MB`;
    } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      statusCode = 503;
      errorMessage = 'Error de conexión con el servidor de archivos';
    } else if (error.code === 'AccessDenied') {
      statusCode = 403;
      errorMessage = 'Acceso denegado al servidor de archivos';
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      details: IS_PRODUCTION ? undefined : error.message
    });
  }
});

// Endpoint para descargar archivo directamente (evita CORS)
app.get('/download/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    console.log(`📥 Solicitud de descarga: ${key}`);
    
    if (!isValidStorageKey(key)) {
      console.error(`❌ Key inválida: ${key}`);
      return res.status(400).json({ error: 'Invalid key format' });
    }

    if (!s3Client) {
      console.error('❌ Cliente S3 no inicializado');
      return res.status(503).json({ error: 'Servicio B2 no disponible' });
    }

    console.log(`📥 Descargando archivo de B2: ${key}`);
    console.log(`   Bucket: ${process.env.B2_BUCKET_NAME}`);

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);

    console.log(`✅ Archivo encontrado en B2`);
    console.log(`   Tamaño: ${(response.ContentLength / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Tipo: ${response.ContentType}`);

    // Configurar headers para la descarga
    res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
    res.setHeader('Content-Length', response.ContentLength);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Headers CORS permisivos para descargas
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

    // Stream el archivo al cliente
    response.Body.pipe(res);

    console.log(`✅ Streaming iniciado`);

  } catch (error) {
    console.error('❌ Error descargando de B2:', error);
    console.error('   Código:', error.code || error.name);
    console.error('   Mensaje:', error.message);
    
    let statusCode = 500;
    let errorMessage = 'Error descargando archivo';
    
    if (error.name === 'NoSuchKey' || error.code === 'NoSuchKey') {
      statusCode = 404;
      errorMessage = 'Archivo no encontrado en B2';
      console.error(`   El archivo ${req.params.key} no existe en el bucket`);
    } else if (error.name === 'AccessDenied' || error.code === 'AccessDenied') {
      statusCode = 403;
      errorMessage = 'Acceso denegado al archivo';
      console.error(`   Verifica las credenciales B2 y permisos del bucket`);
    } else if (error.code === 'CredentialsError') {
      statusCode = 500;
      errorMessage = 'Error de credenciales B2';
      console.error(`   Las credenciales B2 son inválidas o han expirado`);
    }
    
    // Si ya se enviaron headers, no podemos enviar JSON
    if (res.headersSent) {
      console.error('   Headers ya enviados, cerrando conexión');
      res.end();
    } else {
      res.status(statusCode).json({
        error: errorMessage,
        key: req.params.key,
        details: IS_PRODUCTION ? undefined : error.message
      });
    }
  }
});

// Endpoint para borrar archivo de B2
app.delete('/delete/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!isValidStorageKey(key)) {
      return res.status(400).json({ error: 'Invalid key format' });
    }

    console.log(`🗑️ Borrando archivo de B2: ${key}`);

    const command = new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);

    console.log(`✅ Archivo borrado de B2`);

    res.json({ success: true });

  } catch (error) {
    console.error('⚠️ Error borrando de B2:', error);
    res.status(500).json({
      error: error.message || 'Error borrando archivo'
    });
  }
});

// Iniciar servidor solo en desarrollo (no en Vercel serverless)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  🚀 Backblaze B2 Proxy Server                             ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);
    console.log(`\n✅ Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`✅ Bucket: ${process.env.B2_BUCKET_NAME}`);
    console.log(`✅ Endpoint: ${process.env.B2_ENDPOINT}`);
    console.log(`✅ Max upload: ${MAX_UPLOAD_MB}MB`);
    console.log(`✅ Rate limit: ${RATE_LIMIT_MAX_REQUESTS}/${RATE_LIMIT_WINDOW_MS}ms`);
    console.log(`✅ Token auth: ${SERVER_TOKEN ? 'enabled' : 'disabled (dev mode)'}`);
    if (IS_PRODUCTION) {
      console.log(`✅ Allowed origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : '(none configured)'}`);
    }
    console.log(`\n📝 Endpoints disponibles:`);
    console.log(`   POST   /upload          - Subir archivo`);
    console.log(`   GET    /download/:key   - Obtener URL de descarga`);
    console.log(`   DELETE /delete/:key     - Borrar archivo`);
    console.log(`   GET    /health          - Health check`);
    console.log(`\n⏸️  Presiona Ctrl+C para detener\n`);
  });
}

// Exportar para Vercel serverless
export default app;
