-- ============================================================
-- Ghost Drop — Migration
-- Ejecuta cada bloque POR SEPARADO en Supabase → SQL Editor
-- ============================================================

-- ── BLOQUE 1: Columna content_type ──────────────────────────
ALTER TABLE drops ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'file';
UPDATE drops SET content_type = 'file' WHERE content_type IS NULL;

-- ── BLOQUE 2: Función RPC para calibración de tiempo ────────
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT NOW();
$$;

-- ── BLOQUE 3: Replica identity (para Realtime DELETE) ───────
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE drops REPLICA IDENTITY FULL;

-- ── BLOQUE 4: Cron de limpieza automática ───────────────────
-- ⚠️  Solo si tienes pg_cron habilitado:
-- Dashboard → Database → Extensions → pg_cron → Enable
-- Si ya lo habilitaste, ejecuta solo estas líneas:

SELECT cron.schedule(
  'cleanup-expired-drops',
  '*/5 * * * *',
  $$
    DELETE FROM drops WHERE expires_at < NOW();
  $$
);

-- Para ver los jobs activos:
-- SELECT * FROM cron.job;

-- Para eliminar el job si quieres recrearlo:
-- SELECT cron.unschedule('cleanup-expired-drops');
