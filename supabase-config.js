// ─── Supabase Config ───────────────────────────────────────
const SUPABASE_URL     = "https://viyhnxapgzvxriqeiigf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeWhueGFwZ3p2eHJpcWVpaWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEwNTQsImV4cCI6MjA4ODkzNzA1NH0.rGjbv78k5cg_hQQX7Wi4vG72XwG7_JCpntITjDZtfl4";

// Expose globally so app.js can use them in XHR
window.SUPABASE_URL      = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// The UMD build of supabase.min.js declares `var supabase` as the module.
// supabase.createClient is the function we need.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose db globally for ES6 modules
window.db = db;
