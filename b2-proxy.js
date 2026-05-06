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

// CORS estricto en producción cuando se define B2_ALLOWED_ORIGINS
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!IS_PRODUCTION) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(new Error('Origin not allowed by CORS'));
    if (allowedOrigins.includes(origin)) return callback(null, true);
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

app.use((err, req, res, next) => {
  if (err && /CORS/i.test(err.message || '')) {
    return res.status(403).json({ error: 'Origin blocked by CORS policy' });
  }
  return next(err);
});

// Configurar multer para archivos grandes (por defecto 500MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
});

// Cliente S3 para Backblaze B2
const s3Client = new S3Client({
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  region: 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'b2-proxy',
    bucket: process.env.B2_BUCKET_NAME
  });
});

// Endpoint para configurar CORS en B2
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

// Endpoint para obtener URL firmada de subida
app.post('/get-upload-url', async (req, res) => {
  try {
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
      error: error.message || 'Error generando URL de subida'
    });
  }
});

// Endpoint para subir archivo a B2 con progreso real
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
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
        'original-name': originalName
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
    res.status(500).json({
      error: error.message || 'Error subiendo archivo'
    });
  }
});

// Endpoint para descargar archivo directamente (evita CORS)
app.get('/download/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!isValidStorageKey(key)) {
      return res.status(400).json({ error: 'Invalid key format' });
    }

    console.log(`📥 Descargando archivo de B2: ${key}`);

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);

    // Configurar headers para la descarga
    res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
    res.setHeader('Content-Length', response.ContentLength);
    if (!IS_PRODUCTION || allowedOrigins.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Stream el archivo al cliente
    response.Body.pipe(res);

    console.log(`✅ Archivo descargado (${(response.ContentLength / 1024 / 1024).toFixed(2)} MB)`);

  } catch (error) {
    console.error('❌ Error descargando:', error);
    res.status(500).json({
      error: error.message || 'Error descargando archivo'
    });
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
