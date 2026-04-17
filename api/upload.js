// Vercel Serverless Function — sube archivos a Backblaze B2
// Las credenciales van en variables de entorno de Vercel (nunca en el cliente)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const B2_BUCKET    = "ghost-drop";
const B2_ENDPOINT  = `https://${process.env.B2_ENDPOINT}`;
const B2_KEY_ID    = process.env.B2_KEY_ID;
const B2_APP_KEY   = process.env.B2_APP_KEY;
const B2_REGION    = "us-east-005";

const s3 = new S3Client({
  endpoint: B2_ENDPOINT,
  region:   B2_REGION,
  credentials: {
    accessKeyId:     B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
});

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-file-name, x-room-id");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  try {
    const fileName = req.headers["x-file-name"] || "file";
    const roomId   = req.headers["x-room-id"]   || "unknown";
    const ext      = fileName.split(".").pop() || "bin";
    const key      = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Leer el body como buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length > 100 * 1024 * 1024) {
      return res.status(413).json({ error: "File too large (max 100MB)" });
    }

    await s3.send(new PutObjectCommand({
      Bucket:      B2_BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: req.headers["content-type"] || "application/octet-stream",
    }));

    // URL pública del archivo
    const url = `${B2_ENDPOINT}/file/${B2_BUCKET}/${key}`;

    return res.status(200).json({ key, url });
  } catch (err) {
    console.error("B2 upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}
