// ─── Supabase Config ───────────────────────────────────────
const SUPABASE_URL     = "https://viyhnxapgzvxriqeiigf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeWhueGFwZ3p2eHJpcWVpaWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEwNTQsImV4cCI6MjA4ODkzNzA1NH0.rGjbv78k5cg_hQQX7Wi4vG72XwG7_JCpntITjDZtfl4";

// El UMD build de supabase.min.js ya declaró `var supabase` como el módulo.
// supabase.createClient es la función que necesitamos.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
