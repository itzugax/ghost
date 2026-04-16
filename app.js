// ============================================================
// GHOST-DROP — Protocolo Fantasma
// ============================================================

const TTL_SECONDS = 300; // 5 minutos

let roomId = null;
let realtimeChannel = null;

// ─── UI Elements ───────────────────────────────────────────
const statusEl        = document.getElementById("status");
const roomEl          = document.getElementById("room-id");
const dropzone        = document.getElementById("dropzone");
const fileInput       = document.getElementById("file-input");
const uploadBtn       = document.getElementById("upload-btn");
const filesList       = document.getElementById("files-list");
const progressBar     = document.getElementById("progress-bar");
const progressWrap    = document.getElementById("progress-wrap");
const timerEl         = document.getElementById("timer");

// ─── Helpers ───────────────────────────────────────────────

function setStatus(msg, type = "info") {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}

function hashString(str) {
  // FNV-1a 32-bit — rápido, suficiente para room IDs
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Geolocalización e IP ──────────────────────────────────

async function getPublicIP() {
  try {
    // Usamos un servicio público sin API key
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch {
    return null;
  }
}

function getGeoLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Redondeamos a ~100m de precisión (3 decimales ≈ 111m)
        const lat = pos.coords.latitude.toFixed(3);
        const lng = pos.coords.longitude.toFixed(3);
        resolve(`${lat},${lng}`);
      },
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}

async function resolveRoomId() {
  setStatus("Detectando tu zona…", "info");

  // Intentamos geo primero (más preciso para ~100m)
  const geo = await getGeoLocation();
  if (geo) {
    setStatus("Zona detectada por GPS", "success");
    return hashString(`geo:${geo}`);
  }

  // Fallback: IP pública (misma red/router)
  const ip = await getPublicIP();
  if (ip) {
    setStatus("Zona detectada por red compartida", "success");
    return hashString(`ip:${ip}`);
  }

  // Último recurso: sala pública de emergencia (no recomendado)
  setStatus("No se pudo detectar zona — usando sala de emergencia", "warn");
  return "000000ff";
}

// ─── db: sala y archivos ─────────────────────────────

async function ensureRoom(id) {
  const { error } = await db
    .from("rooms")
    .upsert({ id, last_seen: new Date().toISOString() }, { onConflict: "id" });

  if (error) console.error("ensureRoom:", error);
}

async function loadFiles() {
  const { data, error } = await db
    .from("drops")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) { console.error("loadFiles:", error); return; }

  renderFiles(data || []);
}

function renderFiles(files) {
  filesList.innerHTML = "";

  if (!files.length) {
    filesList.innerHTML = `<li class="empty">No hay archivos en esta zona. Sé el primero en dejar uno.</li>`;
    return;
  }

  files.forEach((f) => {
    const expiresAt = new Date(f.expires_at);
    const secsLeft  = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

    const li = document.createElement("li");
    li.dataset.id = f.id;
    li.innerHTML = `
      <span class="fname">📄 ${f.file_name}</span>
      <span class="fsize">${formatBytes(f.file_size)}</span>
      <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
      <button class="dl-btn" data-path="${f.storage_path}" data-id="${f.id}" data-name="${f.file_name}">
        ⬇ Descargar
      </button>
    `;
    filesList.appendChild(li);

    // Cuenta regresiva individual por archivo
    startFileTimer(f.id, secsLeft);
  });

  // Delegación de eventos para descarga
  filesList.querySelectorAll(".dl-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      downloadAndDestroy(btn.dataset.path, btn.dataset.id, btn.dataset.name)
    );
  });
}

const fileTimers = {};

function startFileTimer(fileId, secs) {
  clearInterval(fileTimers[fileId]);
  let remaining = secs;
  fileTimers[fileId] = setInterval(() => {
    remaining--;
    const el = document.getElementById(`t-${fileId}`);
    if (!el) { clearInterval(fileTimers[fileId]); return; }
    if (remaining <= 0) {
      el.textContent = "Expirado";
      clearInterval(fileTimers[fileId]);
      // Quitamos el item visualmente
      document.querySelector(`li[data-id="${fileId}"]`)?.remove();
    } else {
      el.textContent = formatCountdown(remaining);
    }
  }, 1000);
}

// ─── Upload ───────────────────────────────────────────────

const ALLOWED_TYPES = null; // null = todos los tipos permitidos
// Para restringir tipos, usa algo como: ["image/", "application/pdf", "text/"]

async function uploadFile(file) {
  if (file.size > 50 * 1024 * 1024) {
    setStatus("El archivo supera el límite de 50 MB", "error");
    return;
  }

  if (file.size === 0) {
    setStatus("El archivo está vacío", "error");
    return;
  }

  if (!roomId) {
    setStatus("Zona no detectada. Recarga la página.", "error");
    return;
  }

  setStatus("Subiendo archivo…", "info");
  progressWrap.style.display = "block";
  progressBar.style.width = "0%";

  const ext       = file.name.split(".").pop();
  const safeName  = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path      = `${roomId}/${safeName}`;
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  // db JS v2 no tiene onUploadProgress nativo en storage,
  // simulamos la barra con un intervalo visual
  let fakeProgress = 0;
  const fakeTimer = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 10, 85);
    progressBar.style.width = fakeProgress + "%";
  }, 150);

  const { error: upErr } = await db.storage
    .from("ghost-drop")
    .upload(path, file, { cacheControl: "0", upsert: false });

  clearInterval(fakeTimer);

  if (upErr) {
    progressWrap.style.display = "none";
    setStatus("Error al subir: " + upErr.message, "error");
    return;
  }

  progressBar.style.width = "95%";

  // Insertar registro en DB
  const { error: dbErr } = await db.from("drops").insert({
    room_id:      roomId,
    file_name:    file.name,
    file_size:    file.size,
    storage_path: path,
    expires_at:   expiresAt,
  });

  if (dbErr) {
    // Si falla la DB, limpiamos el archivo ya subido al storage
    await db.storage.from("ghost-drop").remove([path]);
    progressWrap.style.display = "none";
    setStatus("Error al registrar el archivo: " + dbErr.message, "error");
    return;
  }

  progressBar.style.width = "100%";
  setTimeout(() => { progressWrap.style.display = "none"; }, 800);
  setStatus("Archivo disponible por 5 minutos", "success");
}

// ─── Download & Self-Destruct ──────────────────────────────

async function downloadAndDestroy(storagePath, dropId, fileName) {
  setStatus("Descargando…", "info");

  const { data, error } = await db.storage
    .from("ghost-drop")
    .download(storagePath);

  if (error) {
    setStatus("Error al descargar: " + error.message, "error");
    return;
  }

  // Disparar descarga en el navegador
  const url = URL.createObjectURL(data);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  // 💀 Auto-destrucción
  await db.from("drops").delete().eq("id", dropId);
  await db.storage.from("ghost-drop").remove([storagePath]);

  setStatus("Archivo descargado y eliminado.", "warn");

  // Limpiamos el elemento de la lista
  clearInterval(fileTimers[dropId]);
  document.querySelector(`li[data-id="${dropId}"]`)?.remove();
  if (!filesList.querySelector("li:not(.empty)")) {
    filesList.innerHTML = `<li class="empty">No hay archivos en esta zona.</li>`;
  }
}

// ─── Realtime: escuchar cambios en la sala ─────────────────

function subscribeToRoom() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db
    .channel(`room-${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "drops", filter: `room_id=eq.${roomId}` },
      () => loadFiles()
    )
    .subscribe();
}

// ─── Limpieza de archivos expirados (cliente) ──────────────
// El lado servidor lo debe manejar un cron de db Edge Function,
// pero por si acaso también lo disparamos desde el cliente ocasionalmente.

async function cleanExpired() {
  const { data } = await db
    .from("drops")
    .select("id, storage_path")
    .eq("room_id", roomId)
    .lt("expires_at", new Date().toISOString());

  if (!data?.length) return;

  const paths = data.map((d) => d.storage_path);
  const ids   = data.map((d) => d.id);

  await db.storage.from("ghost-drop").remove(paths);
  await db.from("drops").delete().in("id", ids);
}

// ─── Drag & Drop ──────────────────────────────────────────

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) uploadFile(fileInput.files[0]);
  fileInput.value = "";
});

// ─── Init ─────────────────────────────────────────────────

async function init() {
  setStatus("Detectando tu zona…", "info");

  try {
    roomId = await resolveRoomId();
    roomEl.textContent = `Zona: #${roomId}`;

    await ensureRoom(roomId);
    await cleanExpired();
    await loadFiles();
    subscribeToRoom();

    // Limpieza periódica cada 60 s
    setInterval(cleanExpired, 60_000);
  } catch (err) {
    setStatus("Error al iniciar: " + err.message, "error");
    console.error("init error:", err);
  }
}

init();
