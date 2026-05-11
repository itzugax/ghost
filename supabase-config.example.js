// ─── Supabase Config ───────────────────────────────────────
// Copy this file to supabase-config.js and fill in your values
const SUPABASE_URL     = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

// Expose globally so app.js can use them in XHR
window.SUPABASE_URL      = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// The UMD build of supabase.min.js declares `var supabase` as the module.
// supabase.createClient is the function we need.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose db globally for ES6 modules
window.db = db;
