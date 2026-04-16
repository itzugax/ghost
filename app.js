// ============================================================
// GHOST-DROP — Sistema de salas por código
// ============================================================

const TTL_SECONDS = 300; // 5 minutos

let roomId = null;
let realtimeChannel = null;
const fileTimers = {};

// ─── UI Elements ───────────────────────────────────────────
const statusEl     = document.getElementById("status");
const roomEl       = document.getElementById("room-id");
const dropzone     = document.getElementById("dropzone");
const fileInput    = document.getElementById("file-input");
const filesList    = document.getElementById("files-list");
const progressBar  = document.getElementById("progress-bar");
const progressWrap = document.getElementById("progress-wrap");
const roomInput    = document.getElementById("room-input");
const joinBtn      = document.getElementById("join-btn");
const newBtn       = document.getElementById("new-room-btn");
const copyBtn      = document.getElementById("copy-room-btn");
const roomSection  = document.getElementById("room-section");
const dropSection  = document.getElementById("drop-section");
const listSection  = document.getElementById("list-section");

// ─── Helpers ───────────────────────────────────────────────

function setStatus(msg, type = "info") {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
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

// Genera un código de sala legible: 3 palabras o 6 chars alfanuméricos
function generateRoomCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // sin chars confusos
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function sanitizeCode(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
}

// ─── Room Management ──────────────────────────────────────

async function joinRoom(code) {
  if (!code) return;
  roomId = sanitizeCode(code);
  if (!roomId) {
    setStatus("Código inválido", "error");
    return;
  }

  // Guardar en localStorage para recordar la sala
  localStorage.setItem("ghostdrop-room", roomId);

  roomEl.textContent = `Sala: ${roomId}`;
  copyBtn.dataset.code = roomId;

  // Mostrar secciones de uso
  roomSection.style.display = "none";
  dropSection.style.display = "block";
  listSection.style.display = "block";

  setStatus("Conectando a la sala…", "info");

  await ensureRoom(roomId);
  await cleanExpired();
  await loadFiles();
  subscribeToRoom();

  setStatus(`Sala "${roomId}" activa`, "success");
}

function leaveRoom() {
  // Limpiar timers
  Object.keys(fileTimers).forEach(id => clearInterval(fileTimers[id]));

  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = null;
  roomId = null;
  localStorage.removeItem("ghostdrop-room");

  roomSection.style.display = "block";
  dropSection.style.display = "none";
  listSection.style.display = "none";
  filesList.innerHTML = `<li class="empty">Únete a una sala para ver archivos.</li>`;
  roomInput.value = "";
  setStatus("Sin sala activa", "info");
}

// ─── Supabase: sala y archivos ─────────────────────────────

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
  // Limpiar timers existentes antes de re-renderizar
  Object.keys(fileTimers).forEach(id => {
    clearInterval(fileTimers[id]);
    delete fileTimers[id];
  });

  filesList.innerHTML = "";

  if (!files.length) {
    filesList.innerHTML = `<li class="empty">No hay archivos en esta sala. Sé el primero en dejar uno.</li>`;
    return;
  }

  files.forEach((f) => {
    const expiresAt = new Date(f.expires_at);
    const secsLeft  = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

    // Escapar nombre para evitar XSS
    const safeName = f.file_name.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const li = document.createElement("li");
    li.dataset.id = f.id;
    li.innerHTML = `
      <span class="fname">📄 ${safeName}</span>
      <span class="fsize">${formatBytes(f.file_size)}</span>
      <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
      <button class="dl-btn" data-path="${f.storage_path}" data-id="${f.id}" data-name="${f.file_name}">
        Descargar
      </button>
    `;
    filesList.appendChild(li);

    if (secsLeft > 0) {
      startFileTimer(f.id, secsLeft);
    } else {
      document.getElementById(`t-${f.id}`).textContent = "Expirado";
    }
  });

  filesList.querySelectorAll(".dl-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      downloadAndDestroy(btn.dataset.path, btn.dataset.id, btn.dataset.name)
    );
  });
}

function startFileTimer(fileId, secs) {
  // Siempre limpiar el anterior antes de iniciar uno nuevo
  if (fileTimers[fileId]) clearInterval(fileTimers[fileId]);

  let remaining = secs;
  fileTimers[fileId] = setInterval(() => {
    remaining--;
    const el = document.getElementById(`t-${fileId}`);
    if (!el) {
      clearInterval(fileTimers[fileId]);
      delete fileTimers[fileId];
      return;
    }
    if (remaining <= 0) {
      el.textContent = "Expirado";
      clearInterval(fileTimers[fileId]);
      delete fileTimers[fileId];
      document.querySelector(`li[data-id="${fileId}"]`)?.remove();
      if (!filesList.querySelector("li:not(.empty)")) {
        filesList.innerHTML = `<li class="empty">No hay archivos en esta sala.</li>`;
      }
    } else {
      el.textContent = formatCountdown(remaining);
    }
  }, 1000);
}

// ─── Upload ───────────────────────────────────────────────

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
    setStatus("Únete a una sala primero", "error");
    return;
  }

  setStatus("Subiendo archivo…", "info");
  progressWrap.style.display = "block";
  progressBar.style.width = "0%";

  const ext       = file.name.split(".").pop();
  const safeName  = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path      = `${roomId}/${safeName}`;
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  let fakeProgress = 0;
  const fakeTimer = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 8, 85);
    progressBar.style.width = fakeProgress + "%";
  }, 200);

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

  const { error: dbErr } = await db.from("drops").insert({
    room_id:      roomId,
    file_name:    file.name,
    file_size:    file.size,
    storage_path: path,
    expires_at:   expiresAt,
  });

  if (dbErr) {
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

  const url = URL.createObjectURL(data);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  await db.from("drops").delete().eq("id", dropId);
  await db.storage.from("ghost-drop").remove([storagePath]);

  setStatus("Archivo descargado y eliminado.", "warn");

  clearInterval(fileTimers[dropId]);
  delete fileTimers[dropId];
  document.querySelector(`li[data-id="${dropId}"]`)?.remove();
  if (!filesList.querySelector("li:not(.empty)")) {
    filesList.innerHTML = `<li class="empty">No hay archivos en esta sala.</li>`;
  }
}

// ─── Realtime ─────────────────────────────────────────────

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

// ─── Limpieza de expirados ─────────────────────────────────

async function cleanExpired() {
  if (!roomId) return;
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

// ─── Room UI Events ────────────────────────────────────────

joinBtn.addEventListener("click", () => {
  const code = sanitizeCode(roomInput.value);
  if (!code) { setStatus("Escribe un código de sala", "error"); return; }
  joinRoom(code);
});

roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

newBtn.addEventListener("click", () => {
  roomInput.value = generateRoomCode();
  joinBtn.click();
});

copyBtn.addEventListener("click", () => {
  const code = copyBtn.dataset.code;
  navigator.clipboard.writeText(code).then(() => {
    copyBtn.textContent = "¡Copiado!";
    setTimeout(() => copyBtn.textContent = "Copiar código", 2000);
  });
});

document.getElementById("leave-btn")?.addEventListener("click", leaveRoom);

// ─── Init ─────────────────────────────────────────────────

function init() {
  // Ocultar secciones hasta que se una a una sala
  dropSection.style.display = "none";
  listSection.style.display = "none";

  setStatus("Sin sala activa", "info");
  roomEl.textContent = "";

  // Recuperar sala de sesión anterior
  const saved = localStorage.getItem("ghostdrop-room");
  if (saved) {
    roomInput.value = saved;
    setStatus(`Reconectando a sala anterior: ${saved}…`, "info");
    joinRoom(saved);
  }

  // Limpieza periódica
  setInterval(cleanExpired, 60_000);
}

init();
