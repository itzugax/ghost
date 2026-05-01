-- ============================================================
-- Ghost Drop — Cron Job Fix
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- PASO 1: Crear función que borra drops expirados + storage
CREATE OR REPLACE FUNCTION cleanup_expired_drops()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_drop RECORD;
BEGIN
  -- Buscar drops expirados
  FOR expired_drop IN 
    SELECT id, storage_path, content_type 
    FROM drops 
    WHERE expires_at < NOW()
  LOOP
    -- Borrar archivo del storage (si no es texto)
    IF expired_drop.content_type != 'text' AND expired_drop.storage_path IS NOT NULL THEN
      PERFORM storage.delete_object('ghost-drop', expired_drop.storage_path);
    END IF;
    
    -- Borrar registro de la DB
    DELETE FROM drops WHERE id = expired_drop.id;
  END LOOP;
END;
$$;

-- PASO 2: Borrar cron job anterior (si existe)
SELECT cron.unschedule('cleanup-expired-drops');

-- PASO 3: Crear nuevo cron job que usa la función
SELECT cron.schedule(
  'cleanup-expired-drops',
  '*/5 * * * *',
  $$SELECT cleanup_expired_drops()$$
);

-- PASO 4: Verificar que se creó correctamente
SELECT jobid, schedule, command, active, jobname 
FROM cron.job 
WHERE jobname = 'cleanup-expired-drops';

-- PASO 5: Probar manualmente (ejecuta esto para ver si funciona)
-- SELECT cleanup_expired_drops();
