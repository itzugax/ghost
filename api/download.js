// Vercel Serverless Function — genera URL de descarga desde B2

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { key, filename } = req.query;
  if (!key) return res.status(400).json({ error: "Missing key" });

  try {
    const auth = await getB2Auth();
    const { authorizationToken, downloadUrl } = auth;

    // URL de descarga con token de autorización (válida 1 hora)
    const dlRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method:  "POST",
      headers: {
        Authorization:  authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId:               process.env.B2_BUCKET_ID,
        fileNamePrefix:         key,
        validDurationInSeconds: 3600,
      }),
    });

    if (!dlRes.ok) throw new Error("Could not get download auth");
    const { authorizationToken: dlToken } = await dlRes.json();

    const url = `${downloadUrl}/file/ghost-drop/${key}?Authorization=${dlToken}`;
    return res.status(200).json({ url });
  } catch (err) {
    console.error("B2 download error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
