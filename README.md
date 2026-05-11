# 👻 Ghost Drop

> Share files in 5 seconds. No signup. No apps. E2E encrypted.

The fastest way to share files. Generate a 6-digit room code, drag your files, share the code. Files auto-destruct after a configurable time (1-15 minutes). Zero registration.

🔥 **Live on Product Hunt!** [gdrop.vercel.app](https://gdrop.vercel.app)

---

## Why it's different

| Other apps | Ghost Drop |
|------------|------------|
| ❌ Mandatory signup | ✅ Zero signup |
| ❌ App download (50MB+) | ✅ Web only |
| ❌ Email login | ✅ 6-digit code |
| ❌ Permanent files | ✅ Auto-destruction |
| ❌ 5 minutes setup | ✅ 5 seconds |
| ❌ Opaque or no encryption | ✅ Transparent E2E encryption |
| ❌ Limited free tiers | ✅ Free, no account needed |

## 🔐 Security

- **Real E2E encryption**: AES-256-GCM via Web Crypto API for files and text
- **Derived key**: PBKDF2 with 100,000 iterations from room code
- **Server sees only ciphertext**: Not even we can read your files
- **Auto-destruction**: Files delete automatically (1-15 min)
- **Privacy by design**: No accounts, no user profiles, no tracking

## 💡 Use cases

- 🎤 **Events/conferences**: "Scan the QR for the slides"
- 💼 **Meetings**: No "can you email me that?"
- 🏫 **Classrooms**: Teacher → 30 students in seconds
- 🏢 **Offices**: Between desks without Slack/Teams
- ✈️ **Travel**: Share photos without WhatsApp compression
- 🔧 **Tech support**: Send logs without uploading to public services

---

## 🛠️ Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Create tables (SQL Editor)

```sql
-- Rooms table
create table rooms (
  id text primary key,
  last_seen timestamptz default now()
);

-- Drops table
create table drops (
  id uuid primary key default gen_random_uuid(),
  room_id text references rooms(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  storage_path text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Indexes
create index drops_room_id_idx on drops(room_id);
create index drops_expires_at_idx on drops(expires_at);
```

### 3. Enable Realtime

In Supabase dashboard:
- **Database → Replication** → enable `drops` table

### 4. Create Storage bucket

- Name: `ghost-drop`
- Type: **Private**

### 5. Row Level Security (RLS)

```sql
-- Rooms
alter table rooms enable row level security;
create policy "rooms_select_all" on rooms for select using (true);
create policy "rooms_insert_valid_code" on rooms
  for insert with check (id ~ '^[0-9]{6}$');
create policy "rooms_update_valid_code" on rooms
  for update using (id ~ '^[0-9]{6}$') with check (id ~ '^[0-9]{6}$');

-- Drops
alter table drops enable row level security;
create policy "drops_select_all" on drops for select using (true);
create policy "drops_insert_guardrails" on drops
  for insert with check (
    room_id ~ '^[0-9]{6}$'
    and file_size > 0
    and file_size <= 524288000
    and expires_at <= now() + interval '15 minutes'
  );
create policy "drops_delete_all" on drops for delete using (true);

-- Storage
insert into storage.buckets (id, name, public) values ('ghost-drop', 'ghost-drop', false);
create policy "anon upload" on storage.objects for insert with check (bucket_id = 'ghost-drop');
create policy "anon download" on storage.objects for select using (bucket_id = 'ghost-drop');
create policy "anon delete" on storage.objects for delete using (bucket_id = 'ghost-drop');
```

### 6. Cleanup Edge Function

Create an Edge Function to delete expired files:

```typescript
// supabase/functions/cleanup/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await supabase
    .from("drops")
    .select("id, storage_path")
    .lt("expires_at", new Date().toISOString());

  if (data?.length) {
    await supabase.storage.from("ghost-drop").remove(data.map(d => d.storage_path));
    await supabase.from("drops").delete().in("id", data.map(d => d.id));
  }

  return new Response("ok");
});
```

Deploy and schedule:

```bash
supabase functions deploy cleanup --no-verify-jwt
```

Then schedule it to run every minute via Supabase cron.

### 7. Configure credentials

Copy `supabase-config.example.js` to `supabase-config.js` and fill in your values:

```bash
cp supabase-config.example.js supabase-config.js
```

Then edit `supabase-config.js`:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

> **Note:** `supabase-config.js` is git-ignored. Never commit your real credentials.

### ~~Optional: Backblaze B2 for large files~~ → Replaced by Cloudflare R2

Ghost Drop now uses **Cloudflare R2** for files >50MB (up to 500MB) via presigned URLs. R2 is compatible with the S3 API and uses a Cloudflare Worker to generate temporary signed URLs. See `cloudflare-worker-r2.js` for the Worker code.

---

## 🚀 Run locally

Any static server works:

```bash
# Python
python -m http.server 3000

# Node.js
npx serve .
```

---

## 📁 Structure

```
ghost-drop/
├── app.html             # Main app (SPA)
├── index.html           # Landing page
├── style.css            # Design system (dark mode)
├── app.js               # Core logic (rooms, upload, download, realtime)
├── crypto.js            # E2E encryption/decryption (Web Crypto API)
├── i18n.js              # Internationalization (ES/EN)
├── privacy.html         # Privacy policy
├── terms.html           # Terms of service
├── storage-b2-client.js # R2 client (presigned URLs via Worker)
├── api/
│   └── b2-proxy.js      # Vercel B2 proxy (legacy, B2 disabled)
├── supabase-config.js   # Supabase credentials
├── supabase.min.js      # Supabase JS SDK
├── sw.js                # Service Worker (PWA)
├── manifest.json        # PWA manifest
├── vercel.json          # Vercel deployment config
├── cloudflare-worker-b2.js # Legacy B2 Worker (no funcional)
cloudflare-worker-r2.js # Worker: presigned URLs for R2
└── og-image.svg         # Open Graph image
```

## 📜 License

MIT License — see LICENSE file for details.
