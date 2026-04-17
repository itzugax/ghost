// ============================================================
// GHOST-DROP — v3
// ============================================================

let TTL_SECONDS = 300;
let roomId      = null;
let realtimeChannel  = null;
let presenceChannel  = null;
let membersCount     = 0;
const fileTimers = {};
window.serverTimeOffset = 0;

// ─── UI refs ───────────────────────────────────────────────
const statusEl     = document.getElementById("status");
const roomBadge    = document.getElementById("room-badge");
const roomCodeDisp = document.getElementById("room-code-display");
const membersEl    = document.getElementById("members-count");
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
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sanitizeCode(input) {
  return String(input).trim().replace(/[^0-9]/g, "").slice(0, 6);
}

function haptic(pattern = [10]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function recordDownload(fileName, roomId) {
  const key = "ghostdrop-history";
  let history = [];
  try { history = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  history.unshift({ fileName, roomId, at: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
}

function updateTimerColor(el, remaining, total) {
  const pct = remaining / total;
  el.classList.remove("timer-ok", "timer-warn", "timer-danger");
  if (pct > 0.5) el.classList.add("timer-ok");
  else if (pct > 0.2) el.classList.add("timer-warn");
  else el.classList.add("timer-danger");
}

let compactMode = false;
function toggleCompact() {
  compactMode = !compactMode;
  filesList.classList.toggle("compact", compactMode);
  const btn = document.getElementById("compact-btn");
  if (btn) btn.classList.toggle("active", compactMode);
}

function showImagePreview(url, name) {
  const backdrop = document.getElementById("img-modal");
  const img = document.getElementById("img-modal-img");
  const title = document.getElementById("img-modal-title");
  img.src = url;
  title.textContent = name;
  backdrop.classList.remove("hidden");
}

// ─── Tiempo ────────────────────────────────────────────────
// Estrategia: el timer local siempre corre desde Date.now().
// expires_at del servidor solo se usa como referencia absoluta
// para dispositivos que se unen DESPUÉS de que el archivo fue subido.

function getSecsLeft(expiresAt) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function serverNow() {
  return Date.now() + (window.serverTimeOffset || 0);
}

// ─── Contador global ──────────────────────────────────────

async function loadTotalUploads() {
  const el = document.getElementById("total-uploads");
  if (!el) return;
  try {
    const { data, error } = await db
      .from("stats")
      .select("value")
      .eq("key", "total_uploads")
      .single();

    if (error) {
      console.warn("stats error:", error.message);
      setTimeout(loadTotalUploads, 4000);
      return;
    }

    const n = parseInt(data?.value ?? 0, 10);
    el.textContent = `✦ ${n.toLocaleString("es")} archivo${n === 1 ? "" : "s"} compartido${n === 1 ? "" : "s"} hasta ahora`;
  } catch (e) {
    console.warn("loadTotalUploads catch:", e);
    setTimeout(loadTotalUploads, 5000);
  }
}

async function incrementTotalUploads() {
  try {
    await db.rpc("increment_uploads");
    loadTotalUploads(); // refrescar el número
  } catch {}
}

// Límites por sesión (en memoria + localStorage)
const RATE_LIMITS = {
  uploadsPerMinute: 15,       // max 15 archivos por minuto
  uploadsPerHour:   100,      // max 100 archivos por hora
  maxBytesPerHour:  2 * 1024 * 1024 * 1024, // max 2GB por hora
  textsPerMinute:   30,       // max 30 mensajes por minuto
};

function getRateLimitStore() {
  try {
    const raw = localStorage.getItem("ghostdrop-rl");
    const store = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    // Limpiar entradas viejas (> 1 hora)
    Object.keys(store).forEach(k => {
      store[k] = store[k].filter(t => now - t < 3_600_000);
    });
    return store;
  } catch { return {}; }
}

function saveRateLimitStore(store) {
  try { localStorage.setItem("ghostdrop-rl", JSON.stringify(store)); } catch {}
}

function checkRateLimit(type, bytes = 0) {
  const store = getRateLimitStore();
  const now = Date.now();
  const uploads = store.uploads || [];
  const texts   = store.texts   || [];
  const bytelog = store.bytes   || [];

  if (type === "file") {
    const lastMinute = uploads.filter(t => now - t < 60_000);
    if (lastMinute.length >= RATE_LIMITS.uploadsPerMinute) {
      return { ok: false, msg: `Máximo ${RATE_LIMITS.uploadsPerMinute} archivos por minuto. Espera un momento.` };
    }
    if (uploads.length >= RATE_LIMITS.uploadsPerHour) {
      return { ok: false, msg: `Máximo ${RATE_LIMITS.uploadsPerHour} archivos por hora.` };
    }
    const bytesThisHour = bytelog.reduce((a, b) => a + b, 0);
    if (bytesThisHour + bytes > RATE_LIMITS.maxBytesPerHour) {
      return { ok: false, msg: `Límite de 500 MB por hora alcanzado.` };
    }
  }

  if (type === "text") {
    const lastMinute = texts.filter(t => now - t < 60_000);
    if (lastMinute.length >= RATE_LIMITS.textsPerMinute) {
      return { ok: false, msg: `Máximo ${RATE_LIMITS.textsPerMinute} mensajes por minuto.` };
    }
  }

  return { ok: true };
}

function recordRateLimit(type, bytes = 0) {
  const store = getRateLimitStore();
  const now = Date.now();
  if (type === "file") {
    store.uploads = [...(store.uploads || []), now];
    store.bytes   = [...(store.bytes   || []), bytes];
  }
  if (type === "text") {
    store.texts = [...(store.texts || []), now];
  }
  saveRateLimitStore(store);
}

function addRipple(el, e) {
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = (e.clientX - rect.left) - size / 2;
  const y = (e.clientY - rect.top) - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  el.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

function makeRipple(selector) {
  document.querySelectorAll(selector).forEach(el => {
    el.classList.add("ripple-host");
    el.addEventListener("click", e => addRipple(el, e));
  });
}

// ─── Skeleton loader ──────────────────────────────────────
function showSkeleton() {
  filesList.innerHTML = Array(3).fill(`
    <li class="skeleton-item">
      <div class="skeleton skeleton-thumb"></div>
      <div class="skeleton-text">
        <div class="skeleton skeleton-line skeleton-long"></div>
        <div class="skeleton skeleton-line skeleton-short"></div>
      </div>
      <div class="skeleton skeleton-btn"></div>
    </li>
  `).join("");
}

// ─── File preview before upload ───────────────────────────
function showUploadPreview(files) {
  let preview = document.getElementById("upload-preview");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "upload-preview";
    progressWrap.parentNode.insertBefore(preview, progressWrap.nextSibling.nextSibling);
  }
  preview.innerHTML = "";
  Array.from(files).forEach(f => {
    const div = document.createElement("div");
    div.className = "upload-preview-item";
    div.innerHTML = `
      <span class="upload-preview-icon">${getFileIcon(f.name)}</span>
      <span class="upload-preview-name">${f.name.replace(/</g,"&lt;")}</span>
      <span class="upload-preview-size">${formatBytes(f.size)}</span>
    `;
    preview.appendChild(div);
  });
}

function clearUploadPreview() {
  const p = document.getElementById("upload-preview");
  if (p) p.innerHTML = "";
}

// ─── Member avatars ───────────────────────────────────────
const AVATAR_COLORS = ["avatar-0","avatar-1","avatar-2","avatar-3","avatar-4","avatar-5"];
const memberColors = new Map(); // userId → colorClass

function getAvatarColor(userId) {
  if (!memberColors.has(userId)) {
    memberColors.set(userId, AVATAR_COLORS[memberColors.size % AVATAR_COLORS.length]);
  }
  return memberColors.get(userId);
}

function updateMembersUI() {
  if (!membersEl) return;
  const state = presenceChannel?.presenceState?.() || {};
  const users = Object.entries(state);
  membersCount = users.length;

  if (membersCount <= 1) {
    membersEl.innerHTML = "";
    return;
  }

  // Mostrar avatares de colores
  const avatarsHtml = users.slice(0, 6).map(([uid]) => {
    const color = getAvatarColor(uid);
    const letter = uid.slice(0, 1).toUpperCase();
    return `<div class="avatar ${color}" title="Usuario">${letter}</div>`;
  }).join("");

  const extra = membersCount > 6 ? `<div class="avatar avatar-5">+${membersCount - 6}</div>` : "";
  membersEl.innerHTML = `<div class="members-avatars">${avatarsHtml}${extra}</div>`;
}

// ─── Typing indicator ─────────────────────────────────────
let typingTimer = null;
let isTyping = false;

function broadcastTyping() {
  if (!presenceChannel || !roomId) return;
  presenceChannel.track({ online_at: new Date().toISOString(), typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    presenceChannel.track({ online_at: new Date().toISOString(), typing: false });
    isTyping = false;
  }, 2000);
}

function updateTypingUI(state, myUserId) {
  const typingEl = document.getElementById("typing-indicator");
  if (!typingEl) return;
  const othersTyping = Object.entries(state)
    .filter(([uid, data]) => uid !== myUserId && data[0]?.typing);
  if (othersTyping.length) {
    typingEl.classList.add("visible");
  } else {
    typingEl.classList.remove("visible");
  }
}

// ─── Expire animation ─────────────────────────────────────
function animateExpire(fileId) {
  const li = document.querySelector(`li[data-id="${fileId}"]`);
  if (!li) return;
  li.classList.add("drop-expiring");
  li.addEventListener("animationend", () => {
    li.remove();
    updateDropCount();
  }, { once: true });
}


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

// ─── TTL ───────────────────────────────────────────────────

document.querySelectorAll(".ttl-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.closest(".ttl-options").querySelectorAll(".ttl-btn")
       .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    TTL_SECONDS = parseInt(btn.dataset.secs);
  });
});

// ─── Calibrar tiempo con servidor ──────────────────────────
// Usa una función RPC que devuelve NOW() del servidor
// Si no existe la función, calcula a partir de ping

async function calibrateServerTime() {
  try {
    // 3 pings para mayor precisión — usamos la mediana
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const { data, error } = await db.rpc("get_server_time").single();
      const t1 = Date.now();
      if (!error && data) {
        const latency  = (t1 - t0) / 2;
        const serverMs = new Date(data).getTime();
        samples.push(serverMs - (t0 + latency));
      }
    }
    if (samples.length) {
      samples.sort((a, b) => a - b);
      window.serverTimeOffset = samples[Math.floor(samples.length / 2)];
      console.log(`Server offset: ${window.serverTimeOffset}ms`);
    }
  } catch {
    window.serverTimeOffset = 0;
  }
}

// ─── Room ──────────────────────────────────────────────────

async function joinRoom(code) {
  const clean = sanitizeCode(code);
  if (clean.length < 6) { setStatus("Código de 6 dígitos", "error"); return; }

  roomId = clean;
  addRecent(roomId);
  renderRecent();
  roomCodeDisp.textContent = `Sala ${roomId}`;
  copyBtn.dataset.code = roomId;

  hide(roomSection);
  show(roomBadge, dropSection, textSection, listSection);
  setStatus("Conectando…", "info");

  // Conexiones en paralelo para mayor velocidad
  await Promise.all([
    ensureRoom(roomId),
    cleanExpired(),
  ]);

  await loadFiles();
  subscribeToRoom();
  subscribeToPresence();
  setStatus(`Sala ${roomId} activa`, "success");
}

function leaveRoom() {
  Object.keys(fileTimers).forEach(id => { clearInterval(fileTimers[id]); delete fileTimers[id]; });
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  if (presenceChannel) db.removeChannel(presenceChannel);
  realtimeChannel = null;
  presenceChannel = null;
  roomId = null;
  membersCount = 0;

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
  showSkeleton();
  const { data, error } = await db.from("drops")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (error) { console.error("loadFiles:", error); return; }
  renderDrops(data || []);
}

// ─── Render ────────────────────────────────────────────────

function getFileIcon(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    pdf:"📄",doc:"📝",docx:"📝",xls:"📊",xlsx:"📊",ppt:"📊",pptx:"📊",
    zip:"🗜️",rar:"🗜️","7z":"🗜️",mp4:"🎬",mov:"🎬",avi:"🎬",mkv:"🎬",
    mp3:"🎵",wav:"🎵",flac:"🎵",jpg:"🖼️",jpeg:"🖼️",png:"🖼️",gif:"🖼️",
    webp:"🖼️",svg:"🖼️",txt:"📃",md:"📃",js:"💻",ts:"💻",py:"💻",
    html:"💻",css:"💻",json:"💻",
  };
  return map[ext] || "📎";
}

function isImage(name) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

function renderDrops(items) {
  Object.keys(fileTimers).forEach(id => { clearInterval(fileTimers[id]); delete fileTimers[id]; });
  filesList.innerHTML = "";

  const active = items.filter(f => getSecsLeft(f.expires_at) > 0);
  updateDropCount(active.length);

  if (!active.length) {
    filesList.innerHTML = `<li class="empty">No hay nada en esta sala aún.</li>`;
    return;
  }

  active.forEach(f => {
    const li = buildDropEl(f);
    li.classList.add("drop-visible");
    filesList.appendChild(li);
    const secs = getSecsLeft(f.expires_at);
    startFileTimer(f.id, secs, secs);
  });

  attachDropEvents(filesList);
}

function buildDropEl(f) {
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
        <button class="dl-btn copy-text-btn" data-text="${f.file_name.replace(/"/g, "&quot;")}">Copiar</button>
      </div>
      <div class="ttl-bar-wrap"><div class="ttl-bar" id="bar-${f.id}"></div></div>`;
  } else {
    const icon  = getFileIcon(f.file_name);
    const thumb = isImage(f.file_name) ? `<div class="thumb-wrap" id="thumb-${f.id}"></div>` : "";
    const previewBtn = isImage(f.file_name)
      ? `<button class="dl-btn preview-btn" data-id="${f.id}">👁 Ver</button>` : "";
    li.className = "drop-item drop-file";
    li.innerHTML = `
      ${thumb}
      <div class="drop-file-info">
        <span class="fname">${icon} ${safeName}</span>
        <span class="fsize">${formatBytes(f.file_size)}</span>
      </div>
      <div class="drop-meta">
        <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
        ${previewBtn}
        <button class="dl-btn file-dl-btn"
          data-path="${f.storage_path}"
          data-id="${f.id}"
          data-name="${f.file_name}">↓</button>
      </div>
      <div class="ttl-bar-wrap"><div class="ttl-bar" id="bar-${f.id}"></div></div>`;
    if (isImage(f.file_name)) loadThumbnail(f, li);
  }
  return li;
}

function attachDropEvents(container) {
  container.querySelectorAll(".file-dl-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      haptic();
      downloadAndDestroy(btn.dataset.path, btn.dataset.id, btn.dataset.name);
    });
  });
  container.querySelectorAll(".preview-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      const img = li?.querySelector(".thumb");
      if (img) showImagePreview(img.src, btn.closest("li").querySelector(".fname")?.textContent || "");
    });
  });
  container.querySelectorAll(".copy-text-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.text);
      haptic();
      const orig = btn.textContent;
      btn.textContent = "✓";
      setTimeout(() => btn.textContent = orig, 2000);
      showToast("Copiado", "success");
    });
  });
}

async function loadThumbnail(f, li) {
  try {
    const { data } = await db.storage.from("ghost-drop").download(f.storage_path);
    if (!data) return;
    const wrap = li.querySelector(`#thumb-${f.id}`);
    if (!wrap) return;
    const url = URL.createObjectURL(data);
    const img = document.createElement("img");
    img.src = url;
    img.className = "thumb";
    img.alt = f.file_name;
    img.style.cursor = "pointer";
    img.addEventListener("click", () => showImagePreview(url, f.file_name));
    wrap.appendChild(img);
  } catch {}
}

function startFileTimer(fileId, secs, totalSecs) {
  if (fileTimers[fileId]) { clearInterval(fileTimers[fileId]); delete fileTimers[fileId]; }
  if (secs <= 0) return;
  const total = totalSecs ?? secs;
  let remaining = secs;

  // Actualizar color y texto cada segundo
  const el = document.getElementById(`t-${fileId}`);
  if (el) { el.textContent = formatCountdown(remaining); updateTimerColor(el, remaining, total); }

  // rAF loop para la barra — fluido a 60fps
  const startTime = performance.now();
  const startRemaining = remaining;

  function rafBar() {
    const bar = document.getElementById(`bar-${fileId}`);
    if (!bar) return;
    const elapsed = (performance.now() - startTime) / 1000;
    const current = Math.max(0, startRemaining - elapsed);
    bar.style.width = Math.max(0, (current / total) * 100) + "%";
    if (current > 0) requestAnimationFrame(rafBar);
  }
  requestAnimationFrame(rafBar);

  fileTimers[fileId] = setInterval(() => {
    remaining--;
    const el = document.getElementById(`t-${fileId}`);
    if (!el) { clearInterval(fileTimers[fileId]); delete fileTimers[fileId]; return; }
    updateTimerColor(el, remaining, total);
    if (remaining <= 0) {
      clearInterval(fileTimers[fileId]);
      delete fileTimers[fileId];
      animateExpire(fileId);
    } else {
      el.textContent = formatCountdown(remaining);
    }
  }, 1000);
}

function updateDropCount(n) {
  const count = n ?? filesList.querySelectorAll("li:not(.empty)").length;
  const el = dropCount;
  const prev = el.textContent;
  const next = count ? `· ${count}` : "";
  el.textContent = next;
  if (count === 0) {
    filesList.innerHTML = `<li class="empty">No hay nada en esta sala aún.</li>`;
  }
  // Pop animation cuando el número cambia
  if (prev !== next && count > 0) {
    el.classList.remove("drop-count-pop");
    void el.offsetWidth; // reflow
    el.classList.add("drop-count-pop");
  }
}

// ─── Upload ────────────────────────────────────────────────

async function uploadFiles(files) {
  if (!roomId) { showToast("Únete a una sala primero", "error"); return; }
  let uploaded = 0;

  for (const file of Array.from(files)) {
    if (file.size > 100 * 1024 * 1024) { showToast(`${file.name}: supera 100 MB`, "error"); continue; }
    if (file.size === 0) continue;

    // Rate limit check
    const rl = checkRateLimit("file", file.size);
    if (!rl.ok) { showToast(rl.msg, "error"); break; }
    recordRateLimit("file", file.size);

    // ── Mostrar progreso ──────────────────────────────────
    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    progressBar.classList.add("progress-indeterminate");
    setProgressLabel(0, file.size);
    showToast(`Subiendo ${file.name.slice(0, 20)}…`, "info");
    showUploadPreview(files);
    dropzone.classList.add("uploading");

    const ext  = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Velocidad de simulación proporcional al tamaño:
    // archivos pequeños (<1MB) van rápido, grandes van lento
    const stepMs     = 150;
    const totalSteps = Math.max(10, Math.min(60, Math.floor(file.size / (1024 * 100))));
    const stepPct    = 82 / totalSteps;
    let prog = 0;
    const ticker = setInterval(() => {
      prog = Math.min(prog + stepPct, 82);
      progressBar.style.width = prog + "%";
      setProgressLabel(prog / 100, file.size);
    }, stepMs);

    const { error: upErr } = await db.storage.from("ghost-drop")
      .upload(path, file, { cacheControl: "0", upsert: false });

    clearInterval(ticker);

    if (upErr) {
      progressWrap.style.display = "none";
      progressBar.classList.remove("progress-pulse", "progress-indeterminate");
      setProgressLabel(0, 0);
      dropzone.classList.remove("uploading");
      showToast(`Error: ${upErr.message}`, "error");
      continue;
    }

    // ── Subida terminada → creep lento hasta 98% con pulso ──
    progressBar.classList.add("progress-pulse");
    prog = 85;
    progressBar.style.width = prog + "%";
    setProgressLabel(0.85, file.size);
    document.getElementById("progress-label").textContent = "Finalizando… No cierres la pestaña";

    // Creep artificial 85 → 98% mientras se hace el INSERT
    const creep = setInterval(() => {
      if (prog < 98) {
        prog = Math.min(prog + 0.4, 98);
        progressBar.style.width = prog + "%";
      }
    }, 200);

    const expiresAt = new Date(serverNow() + TTL_SECONDS * 1000).toISOString();
    const { error: dbErr, data: insertData } = await db.from("drops").insert({
      room_id: roomId, file_name: file.name, file_size: file.size,
      storage_path: path, expires_at: expiresAt, content_type: "file",
    }).select("id").single();

    clearInterval(creep);

    if (dbErr) {
      await db.storage.from("ghost-drop").remove([path]);
      progressWrap.style.display = "none";
      progressBar.classList.remove("progress-pulse", "progress-indeterminate");
      dropzone.classList.remove("uploading");
      showToast(`Error BD: ${dbErr.message}`, "error");
      continue;
    }

    if (insertData?.id) myRecentDrops.set(insertData.id, TTL_SECONDS);
    incrementTotalUploads();

    // ── 100% y cierre suave ──────────────────────────────
    progressBar.classList.remove("progress-pulse", "progress-indeterminate");
    progressBar.style.width = "100%";
    setProgressLabel(1, file.size);
    uploaded++;
    await new Promise(r => setTimeout(r, 500));
    progressWrap.style.display = "none";
    setProgressLabel(0, 0);
    dropzone.classList.remove("uploading");
    clearUploadPreview();
  }

  if (uploaded) showToast(`${uploaded} archivo(s) compartido(s) ✓`, "success");
}

function setProgressLabel(ratio, totalBytes) {
  const label = document.getElementById("progress-label");
  if (!label) return;
  if (!totalBytes) { label.textContent = ""; return; }
  const done = Math.floor(ratio * totalBytes);
  label.textContent = `${formatBytes(done)} / ${formatBytes(totalBytes)}`;
}

// ─── Texto ─────────────────────────────────────────────────

async function sendText() {
  const text = textInput.value.trim();
  if (!text || !roomId) return;

  const rl = checkRateLimit("text");
  if (!rl.ok) { showToast(rl.msg, "error"); return; }
  recordRateLimit("text");
  const expiresAt = new Date(serverNow() + TTL_SECONDS * 1000).toISOString();
  const { error, data: insertData } = await db.from("drops").insert({
    room_id: roomId, file_name: text, file_size: text.length,
    storage_path: "", expires_at: expiresAt, content_type: "text",
  }).select("id").single();
  if (error) { showToast(`Error: ${error.message}`, "error"); return; }
  // Registrar TTL exacto para el timer local
  if (insertData?.id) myRecentDrops.set(insertData.id, TTL_SECONDS);
  textInput.value = "";
  showToast("Texto compartido ✓", "success");
}

// ─── Download ──────────────────────────────────────────────

async function downloadAndDestroy(storagePath, dropId, fileName) {
  showToast("Preparando descarga…", "info");

  // Generar URL firmada — el browser descarga directo desde Supabase
  // sin pasar el archivo por el cliente (mucho más rápido)
  const { data, error } = await db.storage
    .from("ghost-drop")
    .createSignedUrl(storagePath, 60); // válida 60 segundos

  if (error) {
    showToast(`Error: ${error.message}`, "error");
    return;
  }

  // Abrir la URL firmada directamente — descarga instantánea
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = fileName;
  a.target = "_blank";
  a.click();

  haptic([10, 50, 10]);
  recordDownload(fileName, roomId);
  showToast("Descarga iniciada", "success");
}

// ─── Realtime drops ────────────────────────────────────────

// Guarda el ID del drop que acabamos de subir nosotros mismos
// para arrancar su timer con TTL exacto en vez de expires_at del servidor
const myRecentDrops = new Map(); // id → ttlSeconds

function subscribeToRoom() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db
    .channel(`drops-${roomId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "drops", filter: `room_id=eq.${roomId}` },
      ({ new: f }) => {
        if (!f || getSecsLeft(f.expires_at) <= 0) return;
        if (document.querySelector(`li[data-id="${f.id}"]`)) return;
        notifyNewDrop(f.file_name, f.content_type);

        // Si es nuestro propio drop, usar TTL exacto
        const myTTL = myRecentDrops.get(f.id);
        prependDrop(f, myTTL ?? null);
        myRecentDrops.delete(f.id);
      }
    )
    .on("postgres_changes",
      { event: "DELETE", schema: "public", table: "drops", filter: `room_id=eq.${roomId}` },
      ({ old: f }) => {
        if (!f?.id) return;
        clearInterval(fileTimers[f.id]);
        delete fileTimers[f.id];
        document.querySelector(`li[data-id="${f.id}"]`)?.remove();
        updateDropCount();
      }
    )
    .subscribe();
}

function prependDrop(f, exactTTL = null) {
  filesList.querySelector(".empty")?.remove();
  const li = buildDropEl(f);
  li.classList.add("drop-new");
  filesList.prepend(li);
  li.getBoundingClientRect();
  li.classList.add("drop-visible", "drop-pulse");
  attachDropEvents(li);
  // Siempre usar expires_at del servidor — fuente de verdad única
  // para que todos los dispositivos muestren el mismo tiempo
  const secs = getSecsLeft(f.expires_at);
  startFileTimer(f.id, secs, secs);
  updateDropCount();
}

// ─── Presencia: contador de personas en sala ───────────────

function subscribeToPresence() {
  if (presenceChannel) db.removeChannel(presenceChannel);

  const userId = Math.random().toString(36).slice(2);

  presenceChannel = db.channel(`presence-${roomId}`, {
    config: { presence: { key: userId } },
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      membersCount = Object.keys(state).length;
      updateMembersUI();
      updateTypingUI(state, userId);
    })
    .on("presence", { event: "join" }, ({ key }) => {
      if (key !== userId) {
        showToast("Alguien entró a la sala", "info");
        playPing();
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ online_at: new Date().toISOString(), typing: false });
      }
    });
}

function updateMembersUI() {
  if (!membersEl) return;
  membersEl.textContent = membersCount > 1
    ? `· ${membersCount} personas`
    : "";
}

// ─── Notificaciones ────────────────────────────────────────

function notifyNewDrop(name, type) {
  const label = type === "text" ? "texto" : "archivo";
  showToast(`Nuevo ${label}: ${name.slice(0, 28)}`, "info");
  playPing();

  if (Notification.permission === "granted" && document.hidden) {
    new Notification("Ghost Drop", {
      body: `Nuevo ${label} en sala ${roomId}`,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👻</text></svg>",
    });
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
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

async function requestNotifications() {
  if (!("Notification" in window)) { showToast("No disponible en este navegador", "warn"); return; }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    notifyBtn.classList.add("active");
    showToast("Notificaciones activadas", "success");
  } else {
    showToast("Permiso denegado", "warn");
  }
}

// ─── QR ────────────────────────────────────────────────────

async function showQR() {
  const url = `${location.origin}${location.pathname}?sala=${roomId}`;
  modalCode.textContent = roomId;

  // Limpiar QR anterior
  qrCanvas.innerHTML = "";

  try {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    new QRCode(qrCanvas, {
      text: url,
      width: 220,
      height: 220,
      colorDark:  dark ? "#ffffff" : "#1c1c1e",
      colorLight: dark ? "#1c1c1e" : "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (err) {
    qrCanvas.textContent = `Sala: ${roomId}`;
    console.warn("QR error:", err);
  }
  show(qrModal);
}

// ─── Limpieza expirados ────────────────────────────────────

async function cleanExpired() {
  if (!roomId) return;
  const { data } = await db.from("drops")
    .select("id, storage_path, content_type")
    .eq("room_id", roomId)
    .lt("expires_at", new Date().toISOString());
  if (!data?.length) return;
  const paths = data.filter(d => d.content_type !== "text" && d.storage_path).map(d => d.storage_path);
  if (paths.length) await db.storage.from("ghost-drop").remove(paths);
  await db.from("drops").delete().in("id", data.map(d => d.id));
  console.log(`Cleaned ${data.length} expired drops`);
}

// ─── Eventos ───────────────────────────────────────────────

dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", e => {
  e.preventDefault(); dropzone.classList.remove("drag-over");
  uploadFiles(e.dataTransfer.files);
});
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => { uploadFiles(fileInput.files); fileInput.value = ""; });

joinBtn.addEventListener("click", () => {
  const code = sanitizeCode(roomInput.value);
  if (code.length < 6) { setStatus("Código de 6 dígitos", "error"); return; }
  joinRoom(code);
});
roomInput.addEventListener("keydown", e => { if (e.key === "Enter") joinBtn.click(); });
roomInput.addEventListener("input", () => {
  roomInput.value = roomInput.value.replace(/[^0-9]/g, "").slice(0, 6);
});
newBtn.addEventListener("click", () => joinRoom(generateRoomCode()));

copyBtn.addEventListener("click", () => {
  const url = `${location.origin}${location.pathname}?sala=${copyBtn.dataset.code}`;
  navigator.clipboard.writeText(url).then(() => {
    haptic();
    copyBtn.textContent = "¡Copiado!";
    setTimeout(() => copyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar`, 2000);
  });
});

qrBtn.addEventListener("click", showQR);
qrClose.addEventListener("click", () => hide(qrModal));
qrModal.addEventListener("click", e => { if (e.target === qrModal) hide(qrModal); });
leaveBtn.addEventListener("click", leaveRoom);
sendTextBtn.addEventListener("click", sendText);
textInput.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendText(); });
textInput.addEventListener("input", () => broadcastTyping());
// ─── Invitar ───────────────────────────────────────────────
async function inviteToRoom() {
  const url = `${location.origin}${location.pathname}?sala=${roomId}`;
  // API nativa de compartir (móvil)
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Ghost Drop",
        text: `Únete a mi sala ${roomId} en Ghost Drop`,
        url,
      });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // usuario canceló
    }
  }
  // Fallback: copiar al portapapeles
  navigator.clipboard.writeText(url).then(() => {
    showToast("Link copiado al portapapeles", "success");
    haptic();
  });
}

document.getElementById("invite-btn")?.addEventListener("click", inviteToRoom);

// ─── Init ──────────────────────────────────────────────────

async function init() {
  document.querySelector(".logo").classList.add("logo-animate");
  setTimeout(() => document.querySelector(".logo").classList.remove("logo-animate"), 1000);

  hide(roomBadge, dropSection, textSection, listSection);
  setStatus("Sin sala activa", "info");
  renderRecent();

  document.getElementById("compact-btn")?.addEventListener("click", toggleCompact);
  makeRipple(".btn-primary, .btn-secondary, .badge-btn, .dl-btn");

  // Calibrar ANTES de cualquier operación para que serverNow() sea correcto
  await calibrateServerTime().catch(() => {});

  // Auto-join por URL
  const params = new URLSearchParams(location.search);
  const salaParam = params.get("sala");
  if (salaParam && sanitizeCode(salaParam).length === 6) {
    joinRoom(salaParam);
    return;
  }

  // Pre-rellenar último código usado
  const recent = getRecent();
  if (recent.length) roomInput.value = recent[0];

  setInterval(cleanExpired, 60_000);
  setInterval(calibrateServerTime, 5 * 60_000);
  loadTotalUploads();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();

notifyBtn.addEventListener("click", requestNotifications);
