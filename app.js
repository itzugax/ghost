// ============================================================
// GHOST-DROP — Full featured
// ============================================================

let TTL_SECONDS = 300;
let roomId      = null;
let realtimeChannel = null;
const fileTimers = {};

// ─── UI refs ───────────────────────────────────────────────
const statusEl     = document.getElementById("status");
const roomBadge    = document.getElementById("room-badge");
const roomCodeDisp = document.getElementById("room-code-display");
const roomSection  = document.getElementById("room-section");
const dropSection  = document.getElementById("drop-section");
const textSection  = document.getElementById("text-section");
const listSection  = document.getElementById("list-section");
const dropzone     = document.getElementById("dropzone");
const fileInput    = document.getElementById("file-input");
const progressBar  = document.getElementById("progress-bar");
const progressWrap = document.getElementById("progress-wrap");
const roomInput    = document.getElementById("room-input");
const joinBtn      = document.getElementById("join-btn");
const newBtn       = document.getElementById("new-room-btn");
const copyBtn      = document.getElementById("copy-room-btn");
const qrBtn        = document.getElementById("qr-btn");
const leaveBtn     = document.getElementById("leave-btn");
const filesList    = document.getElementById("files-list");
const dropCount    = document.getElementById("drop-count");
const textInput    = document.getElementById("text-input");
const sendTextBtn  = document.getElementById("send-text-btn");
const notifyBtn    = document.getElementById("notify-btn");
const qrModal      = document.getElementById("qr-modal");
const qrCanvas     = document.getElementById("qr-canvas");
const qrClose      = document.getElementById("qr-close");
const modalCode    = document.getElementById("modal-code");
const toastEl      = document.getElementById("toast");
const recentRooms  = document.getElementById("recent-rooms");
const recentList   = document.getElementById("recent-list");

// ─── Helpers ───────────────────────────────────────────────

function setStatus(msg, type = "info") {
  statusEl.textContent = msg;
  statusEl.className   = `status ${type}`;
}

function show(...els) { els.forEach(el => el && el.classList.remove("hidden")); }
function hide(...els) { els.forEach(el => el && el.classList.add("hidden")); }

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function formatCountdown(s) {
  if (s <= 0) return "Expiró";
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function sanitizeCode(input) {
  return String(input).trim().replace(/[^0-9]/g, "").slice(0, 4);
}

// ─── Toast ─────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, type = "info") {
  toastEl.textContent = msg;
  toastEl.className   = `toast toast-${type}`;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3000);
}

// ─── Recent rooms ──────────────────────────────────────────

function getRecent() {
  try { return JSON.parse(localStorage.getItem("ghostdrop-recent") || "[]"); }
  catch { return []; }
}

function addRecent(code) {
  let list = getRecent().filter(c => c !== code);
  list.unshift(code);
  localStorage.setItem("ghostdrop-recent", JSON.stringify(list.slice(0, 3)));
}

function renderRecent() {
  const list = getRecent();
  if (!list.length) { hide(recentRooms); return; }
  show(recentRooms);
  recentList.innerHTML = "";
  list.forEach(code => {
    const btn = document.createElement("button");
    btn.className   = "recent-chip";
    btn.textContent = code;
    btn.addEventListener("click", () => joinRoom(code));
    recentList.appendChild(btn);
  });
}

// ─── TTL selector ──────────────────────────────────────────

document.querySelectorAll(".ttl-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.closest(".ttl-options").querySelectorAll(".ttl-btn")
       .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    TTL_SECONDS = parseInt(btn.dataset.secs);
  });
});

// ─── Room ──────────────────────────────────────────────────

async function joinRoom(code) {
  const clean = sanitizeCode(code);
  if (clean.length < 4) { setStatus("Código de 4 dígitos", "error"); return; }

  roomId = clean;
  addRecent(roomId);
  renderRecent();
  roomCodeDisp.textContent = `Sala ${roomId}`;
  copyBtn.dataset.code = roomId;

  hide(roomSection);
  show(roomBadge, dropSection, textSection, listSection);

  setStatus("Conectando…", "info");
  await ensureRoom(roomId);
  await cleanExpired();
  await loadFiles();
  subscribeToRoom();
  setStatus(`Sala ${roomId} activa`, "success");
}

function leaveRoom() {
  Object.keys(fileTimers).forEach(id => { clearInterval(fileTimers[id]); delete fileTimers[id]; });
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = null;
  roomId = null;

  hide(roomBadge, dropSection, textSection, listSection);
  show(roomSection);
  filesList.innerHTML = `<li class="empty">No hay nada en esta sala aún.</li>`;
  roomInput.value = "";
  dropCount.textContent = "";
  setStatus("Sin sala activa", "info");
}

// ─── Supabase ──────────────────────────────────────────────

async function ensureRoom(id) {
  const { error } = await db.from("rooms")
    .upsert({ id, last_seen: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("ensureRoom:", error);
}

async function loadFiles() {
  const { data, error } = await db.from("drops")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (error) { console.error("loadFiles:", error); return; }
  renderDrops(data || []);
}

// ─── Render drops ──────────────────────────────────────────

function getFileIcon(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
    ppt: "📊", pptx: "📊", zip: "🗜️", rar: "🗜️", "7z": "🗜️",
    mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬",
    mp3: "🎵", wav: "🎵", flac: "🎵",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    txt: "📃", md: "📃", js: "💻", ts: "💻", py: "💻", html: "💻", css: "💻",
  };
  return map[ext] || "📎";
}

function isImage(name) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
}

// FIX: Usar timestamp del servidor para evitar desincronización
function getSecsLeft(expiresAt) {
  // Calcular offset entre cliente y servidor (guardado al cargar)
  const serverOffset = window.serverTimeOffset || 0;
  const now = Date.now() + serverOffset;
  return Math.max(0, Math.floor((new Date(expiresAt) - now) / 1000));
}

function renderDrops(items) {
  Object.keys(fileTimers).forEach(id => { clearInterval(fileTimers[id]); delete fileTimers[id]; });
  filesList.innerHTML = "";

  const active = items.filter(f => getSecsLeft(f.expires_at) > 0);
  dropCount.textContent = active.length ? `· ${active.length}` : "";

  if (!active.length) {
    filesList.innerHTML = `<li class="empty">No hay nada en esta sala aún.</li>`;
    return;
  }

  active.forEach(f => {
    const secsLeft = getSecsLeft(f.expires_at);
    const safeName = f.file_name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const li = document.createElement("li");
    li.dataset.id = f.id;

    if (f.content_type === "text") {
      const isLink = /^https?:\/\//i.test(f.file_name);
      li.className = "drop-item drop-text";
      li.innerHTML = `
        <div class="drop-text-body">
          <span class="drop-text-icon">${isLink ? "🔗" : "📋"}</span>
          <span class="drop-text-content">${safeName}</span>
        </div>
        <div class="drop-meta">
          <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
          <button class="dl-btn copy-text-btn" data-text="${f.file_name.replace(/"/g, '&quot;')}">Copiar</button>
        </div>
      `;
    } else {
      const icon = getFileIcon(f.file_name);
      const thumb = isImage(f.file_name) ? `<div class="thumb-wrap" id="thumb-${f.id}"></div>` : "";
      li.className = "drop-item drop-file";
      li.innerHTML = `
        ${thumb}
        <div class="drop-file-info">
          <span class="fname">${icon} ${safeName}</span>
          <span class="fsize">${formatBytes(f.file_size)}</span>
        </div>
        <div class="drop-meta">
          <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
          <button class="dl-btn" data-path="${f.storage_path}" data-id="${f.id}" data-name="${f.file_name}">↓</button>
        </div>
      `;
      if (isImage(f.file_name)) loadThumbnail(f, li);
    }

    filesList.appendChild(li);
    if (secsLeft > 0) startFileTimer(f.id, secsLeft);
  });

  filesList.querySelectorAll(".dl-btn:not(.copy-text-btn)").forEach(btn => {
    btn.addEventListener("click", () =>
      downloadAndDestroy(btn.dataset.path, btn.dataset.id, btn.dataset.name));
  });
  filesList.querySelectorAll(".copy-text-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.text);
      btn.textContent = "✓";
      setTimeout(() => btn.textContent = "Copiar", 2000);
      showToast("Texto copiado", "success");
    });
  });
}

async function loadThumbnail(f, li) {
  try {
    const { data, error } = await db.storage.from("ghost-drop").download(f.storage_path);
    if (error || !data) return;
    const url  = URL.createObjectURL(data);
    const wrap = li.querySelector(`#thumb-${f.id}`);
    if (!wrap) return;
    const img = document.createElement("img");
    img.src = url;
    img.className = "thumb";
    img.alt = f.file_name;
    wrap.appendChild(img);
  } catch {}
}

function startFileTimer(fileId, secs) {
  if (fileTimers[fileId]) clearInterval(fileTimers[fileId]);
  let remaining = secs;
  fileTimers[fileId] = setInterval(() => {
    remaining--;
    const el = document.getElementById(`t-${fileId}`);
    if (!el) { clearInterval(fileTimers[fileId]); delete fileTimers[fileId]; return; }
    if (remaining <= 0) {
      el.textContent = "Expiró";
      clearInterval(fileTimers[fileId]);
      delete fileTimers[fileId];
      document.querySelector(`li[data-id="${fileId}"]`)?.remove();
      if (!filesList.querySelector("li:not(.empty)")) {
        filesList.innerHTML = `<li class="empty">No hay nada en esta sala aún.</li>`;
        dropCount.textContent = "";
      }
    } else {
      el.textContent = formatCountdown(remaining);
    }
  }, 1000);
}

// ─── Upload ────────────────────────────────────────────────

async function uploadFiles(files) {
  if (!roomId) { setStatus("Únete a una sala primero", "error"); return; }
  
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      showToast(`${file.name} supera 50 MB`, "error");
      continue;
    }
    if (file.size === 0) continue;

    setStatus(`Subiendo ${file.name}…`, "info");
    show(progressWrap);
    progressBar.style.width = "0%";

    const ext = file.name.split(".").pop();
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${roomId}/${safeName}`;
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

    let prog = 0;
    const timer = setInterval(() => {
      prog = Math.min(prog + 8, 85);
      progressBar.style.width = prog + "%";
    }, 200);

    const { error: upErr } = await db.storage.from("ghost-drop")
      .upload(path, file, { cacheControl: "0", upsert: false });

    clearInterval(timer);

    if (upErr) {
      hide(progressWrap);
      showToast(`Error: ${upErr.message}`, "error");
      continue;
    }

    progressBar.style.width = "95%";

    const { error: dbErr } = await db.from("drops").insert({
      room_id: roomId,
      file_name: file.name,
      file_size: file.size,
      storage_path: path,
      expires_at: expiresAt,
      content_type: "file",
    });

    if (dbErr) {
      await db.storage.from("ghost-drop").remove([path]);
      hide(progressWrap);
      showToast(`Error: ${dbErr.message}`, "error");
      continue;
    }

    progressBar.style.width = "100%";
    setTimeout(() => hide(progressWrap), 800);
  }
  
  setStatus(`${files.length} archivo(s) subido(s)`, "success");
}

async function sendText() {
  const text = textInput.value.trim();
  if (!text) return;
  if (!roomId) { setStatus("Únete a una sala primero", "error"); return; }

  setStatus("Enviando texto…", "info");
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  const { error } = await db.from("drops").insert({
    room_id: roomId,
    file_name: text,
    file_size: text.length,
    storage_path: "",
    expires_at: expiresAt,
    content_type: "text",
  });

  if (error) {
    showToast(`Error: ${error.message}`, "error");
    return;
  }

  textInput.value = "";
  setStatus("Texto enviado", "success");
}

async function downloadAndDestroy(storagePath, dropId, fileName) {
  setStatus("Descargando…", "info");

  const { data, error } = await db.storage.from("ghost-drop").download(storagePath);
  if (error) {
    showToast(`Error: ${error.message}`, "error");
    return;
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  await db.from("drops").delete().eq("id", dropId);
  await db.storage.from("ghost-drop").remove([storagePath]);

  setStatus("Descargado y eliminado", "warn");
  clearInterval(fileTimers[dropId]);
  delete fileTimers[dropId];
  document.querySelector(`li[data-id="${dropId}"]`)?.remove();
  if (!filesList.querySelector("li:not(.empty)")) {
    filesList.innerHTML = `<li class="empty">No hay nada en esta sala aún.</li>`;
    dropCount.textContent = "";
  }
}

// ─── Realtime — FIX: INSERT directo en vez de reload completo ──

function subscribeToRoom() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db
    .channel(`room-${roomId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "drops", filter: `room_id=eq.${roomId}` },
      (payload) => {
        // Añadir el nuevo drop SIN recargar toda la lista
        const f = payload.new;
        if (!f || getSecsLeft(f.expires_at) <= 0) return;

        // Notificación si la pestaña está en segundo plano
        notifyNewDrop(f.file_name, f.content_type);

        // Agregar al DOM directamente (más rápido, sin parpadeo)
        addDropToList(f);
      }
    )
    .on("postgres_changes",
      { event: "DELETE", schema: "public", table: "drops", filter: `room_id=eq.${roomId}` },
      (payload) => {
        const id = payload.old?.id;
        if (!id) return;
        clearInterval(fileTimers[id]);
        delete fileTimers[id];
        document.querySelector(`li[data-id="${id}"]`)?.remove();
        updateDropCount();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Realtime connected");
      }
    });
}

function addDropToList(f) {
  // Quitar el "empty" si existe
  const empty = filesList.querySelector(".empty");
  if (empty) empty.remove();

  const secsLeft = getSecsLeft(f.expires_at);
  const safeName = f.file_name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const li = document.createElement("li");
  li.dataset.id = f.id;

  if (f.content_type === "text") {
    const isLink = /^https?:\/\//i.test(f.file_name);
    li.className = "drop-item drop-text drop-new";
    li.innerHTML = `
      <div class="drop-text-body">
        <span class="drop-text-icon">${isLink ? "🔗" : "📋"}</span>
        <span class="drop-text-content">${safeName}</span>
      </div>
      <div class="drop-meta">
        <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
        <button class="dl-btn copy-text-btn" data-text="${f.file_name.replace(/"/g, '&quot;')}">Copiar</button>
      </div>
    `;
  } else {
    const icon = getFileIcon(f.file_name);
    const thumb = isImage(f.file_name) ? `<div class="thumb-wrap" id="thumb-${f.id}"></div>` : "";
    li.className = "drop-item drop-file drop-new";
    li.innerHTML = `
      ${thumb}
      <div class="drop-file-info">
        <span class="fname">${icon} ${safeName}</span>
        <span class="fsize">${formatBytes(f.file_size)}</span>
      </div>
      <div class="drop-meta">
        <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
        <button class="dl-btn" data-path="${f.storage_path}" data-id="${f.id}" data-name="${f.file_name}">↓</button>
      </div>
    `;
    if (isImage(f.file_name)) loadThumbnail(f, li);
  }

  // Insertar al inicio
  filesList.prepend(li);
  updateDropCount();

  // Animación de entrada
  requestAnimationFrame(() => li.classList.add("drop-visible"));

  // Eventos
  li.querySelector(".dl-btn:not(.copy-text-btn)")?.addEventListener("click", btn => {
    const b = btn.target.closest(".dl-btn");
    downloadAndDestroy(b.dataset.path, b.dataset.id, b.dataset.name);
  });
  li.querySelector(".copy-text-btn")?.addEventListener("click", (e) => {
    const b = e.target.closest(".copy-text-btn");
    navigator.clipboard.writeText(b.dataset.text);
    b.textContent = "✓";
    setTimeout(() => b.textContent = "Copiar", 2000);
    showToast("Texto copiado", "success");
  });

  startFileTimer(f.id, secsLeft);
}

function updateDropCount() {
  const count = filesList.querySelectorAll("li:not(.empty)").length;
  dropCount.textContent = count ? `· ${count}` : "";
}

// ─── Limpieza de expirados ─────────────────────────────────

async function cleanExpired() {
  if (!roomId) return;
  const { data } = await db.from("drops")
    .select("id, storage_path, content_type")
    .eq("room_id", roomId)
    .lt("expires_at", new Date().toISOString());
  if (!data?.length) return;

  const paths = data.filter(d => d.content_type !== "text").map(d => d.storage_path);
  const ids   = data.map(d => d.id);
  if (paths.length) await db.storage.from("ghost-drop").remove(paths);
  await db.from("drops").delete().in("id", ids);
}

// ─── Calibración de tiempo con el servidor ─────────────────
// Resuelve el bug de desincronización entre dispositivos

async function calibrateServerTime() {
  try {
    // Hacemos una query ligera y medimos el timestamp del servidor
    const t0 = Date.now();
    const { data, error } = await db.from("rooms").select("last_seen").limit(1);
    const t1 = Date.now();
    if (!error && data?.length) {
      const serverTime = new Date(data[0].last_seen).getTime();
      const clientMid  = (t0 + t1) / 2;
      window.serverTimeOffset = serverTime - clientMid;
      console.log(`Server time offset: ${window.serverTimeOffset}ms`);
    }
  } catch {
    window.serverTimeOffset = 0;
  }
}

// ─── Notificaciones ────────────────────────────────────────

function notifyNewDrop(name, type) {
  showToast(`Nuevo ${type === "text" ? "texto" : "archivo"}: ${name.slice(0, 30)}`, "info");

  if (Notification.permission === "granted" && document.hidden) {
    new Notification("Ghost Drop", {
      body: `Nuevo ${type === "text" ? "texto" : "archivo"} en sala ${roomId}`,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👻</text></svg>",
      silent: false,
    });

    // Sonido sutil
    playPing();
  }
}

function playPing() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("Notificaciones no disponibles en este navegador", "warn");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    notifyBtn.classList.add("active");
    showToast("Notificaciones activadas", "success");
  }
}

// ─── QR ────────────────────────────────────────────────────

async function showQR() {
  const url = `${window.location.origin}${window.location.pathname}?sala=${roomId}`;
  modalCode.textContent = `Sala ${roomId}`;
  try {
    await QRCode.toCanvas(qrCanvas, url, {
      width: 220,
      margin: 2,
      color: {
        dark: window.matchMedia("(prefers-color-scheme: dark)").matches ? "#ffffff" : "#1c1c1e",
        light: window.matchMedia("(prefers-color-scheme: dark)").matches ? "#1c1c1e" : "#ffffff",
      }
    });
  } catch (err) {
    // Si QRCode no cargó, mostrar el código igual
    console.warn("QR library not available:", err);
  }
  show(qrModal);
}

// ─── Drag & Drop ──────────────────────────────────────────

dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const files = Array.from(e.dataTransfer.files);
  if (files.length) uploadFiles(files);
});
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) uploadFiles(Array.from(fileInput.files));
  fileInput.value = "";
});

// ─── Eventos UI ────────────────────────────────────────────

joinBtn.addEventListener("click", () => {
  const code = sanitizeCode(roomInput.value);
  if (!code || code.length < 4) { setStatus("Código de 4 dígitos", "error"); return; }
  joinRoom(code);
});

roomInput.addEventListener("keydown", (e) => { if (e.key === "Enter") joinBtn.click(); });

// Solo permitir números en el input
roomInput.addEventListener("input", () => {
  roomInput.value = roomInput.value.replace(/[^0-9]/g, "").slice(0, 4);
});

newBtn.addEventListener("click", () => joinRoom(generateRoomCode()));

copyBtn.addEventListener("click", () => {
  const code = copyBtn.dataset.code;
  navigator.clipboard.writeText(code).then(() => {
    copyBtn.textContent = "¡Copiado!";
    setTimeout(() => copyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar`, 2000);
  });
});

qrBtn.addEventListener("click", showQR);
qrClose.addEventListener("click", () => hide(qrModal));
qrModal.addEventListener("click", (e) => { if (e.target === qrModal) hide(qrModal); });

leaveBtn.addEventListener("click", leaveRoom);

sendTextBtn.addEventListener("click", sendText);
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendText();
});

notifyBtn.addEventListener("click", requestNotifications);

// ─── Init ──────────────────────────────────────────────────

async function init() {
  // Calibrar tiempo con servidor para evitar desincronización
  await calibrateServerTime();

  hide(roomBadge, dropSection, textSection, listSection);
  setStatus("Sin sala activa", "info");
  renderRecent();

  // Auto-join si viene de un QR o link con ?sala=XXXX
  const params = new URLSearchParams(window.location.search);
  const salaParam = params.get("sala");
  if (salaParam && sanitizeCode(salaParam).length === 4) {
    roomInput.value = salaParam;
    joinRoom(salaParam);
    return;
  }

  // Reconectar a sala anterior
  const saved = localStorage.getItem("ghostdrop-recent");
  const recent = saved ? JSON.parse(saved) : [];
  if (recent.length) {
    const last = recent[0];
    roomInput.value = last;
  }

  // Limpieza periódica
  setInterval(cleanExpired, 60_000);

  // Re-calibrar cada 5 minutos
  setInterval(calibrateServerTime, 5 * 60_000);
}

init();
