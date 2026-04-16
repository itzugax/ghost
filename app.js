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
    const t0 = Date.now();
    const { data, error } = await db.rpc("get_server_time").single();
    const t1 = Date.now();
    if (!error && data) {
      const serverMs = new Date(data).getTime();
      const latency  = (t1 - t0) / 2;
      window.serverTimeOffset = serverMs - (t0 + latency);
      console.log(`Server offset: ${window.serverTimeOffset}ms (latency: ${latency}ms)`);
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
    li.classList.add("drop-visible"); // ya visible al cargar
    filesList.appendChild(li);
    const secsLeft = getSecsLeft(f.expires_at);
    startFileTimer(f.id, secsLeft, secsLeft);
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
  const el = document.getElementById(`t-${fileId}`);
  if (el) updateTimerColor(el, remaining, total);
  const bar = document.getElementById(`bar-${fileId}`);
  if (bar) bar.style.width = Math.max(0, (remaining / total) * 100) + "%";
  fileTimers[fileId] = setInterval(() => {
    remaining--;
    const el = document.getElementById(`t-${fileId}`);
    if (!el) { clearInterval(fileTimers[fileId]); delete fileTimers[fileId]; return; }
    updateTimerColor(el, remaining, total);
    const bar = document.getElementById(`bar-${fileId}`);
    if (bar) bar.style.width = Math.max(0, (remaining / total) * 100) + "%";
    if (remaining <= 0) {
      clearInterval(fileTimers[fileId]);
      delete fileTimers[fileId];
      document.querySelector(`li[data-id="${fileId}"]`)?.remove();
      updateDropCount();
    } else {
      el.textContent = formatCountdown(remaining);
    }
  }, 1000);
}

function updateDropCount(n) {
  const count = n ?? filesList.querySelectorAll("li:not(.empty)").length;
  dropCount.textContent = count ? `· ${count}` : "";
  if (count === 0) {
    filesList.innerHTML = `<li class="empty">No hay nada en esta sala aún.</li>`;
  }
}

// ─── Upload ────────────────────────────────────────────────

async function uploadFiles(files) {
  if (!roomId) { showToast("Únete a una sala primero", "error"); return; }
  let uploaded = 0;

  for (const file of Array.from(files)) {
    if (file.size > 50 * 1024 * 1024) { showToast(`${file.name}: supera 50 MB`, "error"); continue; }
    if (file.size === 0) continue;

    // ── Mostrar progreso ──────────────────────────────────
    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    setProgressLabel(0, file.size);
    setStatus(`Subiendo ${file.name}…`, "info");

    const ext  = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Velocidad de simulación proporcional al tamaño:
    // archivos pequeños (<1MB) van rápido, grandes van lento
    const stepMs   = 150;
    const totalSteps = Math.max(10, Math.min(60, Math.floor(file.size / (1024 * 100)))); // pasos según tamaño
    const stepPct  = 82 / totalSteps; // llega hasta 82%
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
      setProgressLabel(0, 0);
      showToast(`Error: ${upErr.message}`, "error");
      continue;
    }

    // Subida completa → expiresAt basado en tiempo del servidor
    const expiresAt = new Date(serverNow() + TTL_SECONDS * 1000).toISOString();

    progressBar.style.width = "95%";
    setProgressLabel(0.95, file.size);

    const { error: dbErr, data: insertData } = await db.from("drops").insert({
      room_id: roomId, file_name: file.name, file_size: file.size,
      storage_path: path, expires_at: expiresAt, content_type: "file",
    }).select("id").single();

    if (dbErr) {
      await db.storage.from("ghost-drop").remove([path]);
      progressWrap.style.display = "none";
      showToast(`Error BD: ${dbErr.message}`, "error");
      continue;
    }

    // Registrar que este drop es nuestro, con el TTL exacto elegido
    if (insertData?.id) myRecentDrops.set(insertData.id, TTL_SECONDS);

    progressBar.style.width = "100%";
    setProgressLabel(1, file.size);
    uploaded++;
    await new Promise(r => setTimeout(r, 600));
    progressWrap.style.display = "none";
    setProgressLabel(0, 0);
  }

  if (uploaded) setStatus(`${uploaded} archivo(s) compartido(s)`, "success");
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
  const expiresAt = new Date(serverNow() + TTL_SECONDS * 1000).toISOString();
  const { error, data: insertData } = await db.from("drops").insert({
    room_id: roomId, file_name: text, file_size: text.length,
    storage_path: "", expires_at: expiresAt, content_type: "text",
  }).select("id").single();
  if (error) { showToast(`Error: ${error.message}`, "error"); return; }
  // Registrar TTL exacto para el timer local
  if (insertData?.id) myRecentDrops.set(insertData.id, TTL_SECONDS);
  textInput.value = "";
  setStatus("Texto compartido", "success");
}

// ─── Download ──────────────────────────────────────────────

async function downloadAndDestroy(storagePath, dropId, fileName) {
  setStatus("Descargando…", "info");
  const { data, error } = await db.storage.from("ghost-drop").download(storagePath);
  if (error) { showToast(`Error: ${error.message}`, "error"); return; }

  const url = URL.createObjectURL(data);
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  URL.revokeObjectURL(url);
  haptic([10, 50, 10]);
  recordDownload(fileName, roomId);

  await Promise.all([
    db.from("drops").delete().eq("id", dropId),
    db.storage.from("ghost-drop").remove([storagePath]),
  ]);

  setStatus("Descargado y eliminado", "warn");
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
  li.getBoundingClientRect(); // forzar reflow
  li.classList.add("drop-visible");
  attachDropEvents(li);
  // Si es nuestro propio drop, usar TTL exacto; si no, usar expires_at del servidor
  const secs = exactTTL !== null ? exactTTL : getSecsLeft(f.expires_at);
  startFileTimer(f.id, secs, exactTTL ?? secs);
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
    })
    .on("presence", { event: "join" }, ({ key }) => {
      if (key !== userId) {
        showToast(`Alguien entró a la sala`, "info");
        playPing();
      }
    })
    .on("presence", { event: "leave" }, () => {
      // El sync se actualiza solo
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ online_at: new Date().toISOString() });
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
  navigator.clipboard.writeText(copyBtn.dataset.code).then(() => {
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
notifyBtn.addEventListener("click", requestNotifications);

// ─── Init ──────────────────────────────────────────────────

async function init() {
  document.querySelector(".logo").classList.add("logo-animate");
  setTimeout(() => document.querySelector(".logo").classList.remove("logo-animate"), 1000);

  hide(roomBadge, dropSection, textSection, listSection);
  setStatus("Sin sala activa", "info");
  renderRecent();

  document.getElementById("compact-btn")?.addEventListener("click", toggleCompact);

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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
