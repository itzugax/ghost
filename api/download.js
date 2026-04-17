// Vercel Serverless Function — genera URL firmada para descarga desde B2

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const B2_BUCKET   = "ghost-drop";
const B2_ENDPOINT = `https://${process.env.B2_ENDPOINT}`;
const B2_KEY_ID   = process.env.B2_KEY_ID;
const B2_APP_KEY  = process.env.B2_APP_KEY;
const B2_REGION   = "us-east-005";

const s3 = new S3Client({
  endpoint: B2_ENDPOINT,
  region:   B2_REGION,
  credentials: {
    accessKeyId:     B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { key, filename } = req.query;
  if (!key) return res.status(400).json({ error: "Missing key" });

  try {
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket:                     B2_BUCKET,
      Key:                        key,
      ResponseContentDisposition: `attachment; filename="${filename || key.split("/").pop()}"`,
    }), { expiresIn: 60 }); // válida 60 segundos

    return res.status(200).json({ url });
  } catch (err) {
    console.error("B2 download error:", err);
    return res.status(500).json({ error: err.message });
  }
}
