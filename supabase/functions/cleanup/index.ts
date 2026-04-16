// ============================================================
// Ghost Drop — Edge Function: limpieza automática de archivos
// Deploy: supabase functions deploy cleanup --no-verify-jwt
// Cron:   cada 5 min desde Dashboard → Edge Functions → Schedule
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Buscar drops expirados
  const { data: expired, error } = await supabase
    .from("drops")
    .select("id, storage_path, content_type")
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("Error fetching expired drops:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!expired?.length) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 });
  }

  // 2. Borrar archivos físicos del Storage
  const paths = expired
    .filter(d => d.content_type !== "text" && d.storage_path)
    .map(d => d.storage_path);

  if (paths.length) {
    const { error: storageErr } = await supabase.storage
      .from("ghost-drop")
      .remove(paths);
    if (storageErr) console.warn("Storage remove error:", storageErr.message);
  }

  // 3. Borrar registros de la DB
  const ids = expired.map(d => d.id);
  const { error: deleteErr } = await supabase
    .from("drops")
    .delete()
    .in("id", ids);

  if (deleteErr) {
    console.error("Error deleting drops:", deleteErr);
    return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500 });
  }

  console.log(`Cleaned up ${ids.length} expired drops, ${paths.length} storage files`);
  return new Response(
    JSON.stringify({ deleted: ids.length, storage_files: paths.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
