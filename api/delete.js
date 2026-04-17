// Vercel Serverless Function — elimina archivo de B2

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE")  return res.status(405).json({ error: "Method not allowed" });

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: "Missing key" });

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key }));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("B2 delete error:", err);
    return res.status(500).json({ error: err.message });
  }
}
