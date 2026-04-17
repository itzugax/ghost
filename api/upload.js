// Vercel Serverless Function — sube a Backblaze B2 via API nativa
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "100mb",
  },
};

async function getB2Auth() {
  const keyId  = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APP_KEY;
  const creds  = Buffer.from(`${keyId}:${appKey}`).toString("base64");

  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${creds}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`B2 auth failed: ${err}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-file-name, x-room-id");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  try {
    const fileName = decodeURIComponent(req.headers["x-file-name"] || "file");
    const roomId   = req.headers["x-room-id"] || "unknown";
    const ext      = fileName.includes(".") ? fileName.split(".").pop() : "bin";
    const key      = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Leer body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) return res.status(400).json({ error: "Empty file" });
    if (buffer.length > 100 * 1024 * 1024) return res.status(413).json({ error: "File too large (max 100MB)" });

    // Auth con B2
    const auth = await getB2Auth();
    const { authorizationToken, apiUrl, downloadUrl } = auth;

    // Obtener upload URL
    const urlRes = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method:  "POST",
      headers: {
        Authorization:  authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: process.env.B2_BUCKET_ID }),
    });

    if (!urlRes.ok) {
      const err = await urlRes.text();
      throw new Error(`Get upload URL failed: ${err}`);
    }

    const { uploadUrl, authorizationToken: uploadToken } = await urlRes.json();

    // Subir archivo
    const crypto = await import("crypto");
    const sha1   = crypto.createHash("sha1").update(buffer).digest("hex");

    const uploadRes = await fetch(uploadUrl, {
      method:  "POST",
      headers: {
        Authorization:     uploadToken,
        "X-Bz-File-Name":  encodeURIComponent(key),
        "Content-Type":    req.headers["content-type"] || "application/octet-stream",
        "Content-Length":  buffer.length,
        "X-Bz-Content-Sha1": sha1,
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Upload failed: ${err}`);
    }

    const fileData = await uploadRes.json();
    const url = `${downloadUrl}/file/ghost-drop/${key}`;

    return res.status(200).json({ key, url, fileId: fileData.fileId });
  } catch (err) {
    console.error("B2 upload error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
