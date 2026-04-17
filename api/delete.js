// Vercel Serverless Function — elimina archivo de B2

async function getB2Auth() {
  const keyId  = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APP_KEY;
  const creds  = Buffer.from(`${keyId}:${appKey}`).toString("base64");

  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) throw new Error("B2 auth failed");
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE")  return res.status(405).json({ error: "Method not allowed" });

  const { key, fileId } = req.query;
  if (!key) return res.status(400).json({ error: "Missing key" });

  try {
    const auth = await getB2Auth();

    // Si tenemos fileId, borrar directamente
    if (fileId) {
      await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
        method:  "POST",
        headers: {
          Authorization:  auth.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId, fileName: key }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("B2 delete error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
