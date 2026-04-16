// ─── Supabase Config ───────────────────────────────────────
const SUPABASE_URL     = "https://viyhnxapgzvxriqeiigf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeWhueGFwZ3p2eHJpcWVpaWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEwNTQsImV4cCI6MjA4ODkzNzA1NH0.rGjbv78k5cg_hQQX7Wi4vG72XwG7_JCpntITjDZtfl4";

// Con el CDN de unpkg/jsdelivr, supabase-js v2 expone { createClient } en window.supabase
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
