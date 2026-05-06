-- Script para verificar si la migración de Telegram se ejecutó correctamente

-- 1. Verificar si existen las columnas nuevas
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'drops'
  AND column_name IN ('storage', 'telegram_message_id')
ORDER BY column_name;

-- Si este query devuelve 2 filas, la migración está OK
-- Si devuelve 0 filas, necesitas ejecutar TELEGRAM-MIGRATION.sql

-- 2. Ver la estructura completa de la tabla drops
SELECT 
  column_name, 
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'drops'
ORDER BY ordinal_position;
