-- Ejecuta esto en Supabase → SQL Editor

-- 1. Añadir columna content_type a drops
ALTER TABLE drops ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'file';

-- 2. Actualizar los existentes
UPDATE drops SET content_type = 'file' WHERE content_type IS NULL;
