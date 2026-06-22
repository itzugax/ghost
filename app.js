// ============================================================
// GHOST-DROP — v3
// ============================================================

// Importar módulo de Backblaze B2
import { uploadToB2, downloadFromB2, deleteFromB2, testB2Connection } from './storage-b2-client.js';

// Acceso a variables globales desde módulos ES6
const db = window.db;
const { encryptFile, decryptFile, encryptText, decryptText } = window;

let TTL_SECONDS = 300;
let BURN_AFTER_READING = false;
let roomId      = null;
let realtimeChannel  = null;
let presenceChannel  = null;
let membersCount     = 0;
let roomSyncTimer    = null;
const burnedDropIds  = new Set();
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
  // Sync nav LED
  const ledDot = document.getElementById("status-led-dot");
  const ledText = document.getElementById("status-text");
  if (ledDot) {
    ledDot.className = "led-dot";
    if (type === "success") ledDot.classList.add("on");
    else if (type === "warn") ledDot.classList.add("warn");
    else ledDot.classList.add("off");
  }
  if (ledText) ledText.textContent = msg;
}

function show(...els) { els.forEach(el => el && el.classList.remove("hidden")); }
function hide(...els) { els.forEach(el => el && el.classList.add("hidden")); }

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
  return (b / 1073741824).toFixed(2) + " GB";
}

function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + " B/s";
  if (bytesPerSecond < 1048576) return (bytesPerSecond / 1024).toFixed(1) + " KB/s";
  return (bytesPerSecond / 1048576).toFixed(1) + " MB/s";
}

function formatTime(seconds) {
  if (seconds < 60) return Math.ceil(seconds) + "s";
  if (seconds < 3600) return Math.ceil(seconds / 60) + "m";
  return Math.ceil(seconds / 3600) + "h";
}

function formatCountdown(s) {
  if (s <= 0) return window.i18n.t('timerExpired');
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// ─── Lista negra de códigos prohibidos ────────────────────
const BLACKLISTED_CODES = new Set([
  // Códigos administrativos/sistema
  "ADMIN", "GHOST", "SUPER", "OWNER", "STAFF",
  // Códigos ofensivos comunes
  "FUCK", "SHIT", "DAMN", "HELL", "CRAP",
  // Códigos que podrían causar confusión
  "TEST", "DEBUG", "ERROR", "NULL", "EMPTY",
  // Patrones secuenciales obvios
  "23456", "34567", "45678", "56789", "67892",
  "98765", "87654", "76543", "65432", "54323",
  // Patrones repetitivos
  "22222", "33333", "44444", "55555", "66666",
  "77777", "88888", "99999", "AAAAA", "CCCCC",
  "DDDDD", "EEEEE", "FFFFF", "GGGGG", "HHHHH",
  "JJJJJ", "KKKKK", "LLLLL", "MMMMM", "NNNNN",
  "PPPPP", "QQQQQ", "RRRRR", "SSSSS", "TTTTT",
  "UUUUU", "WWWWW", "XXXXX", "YYYYY", "ZZZZZ",
  // Combinaciones obvias
  "ABC23", "23ABC", "A2A2A", "2A2A2",
  "AAAA2", "2AAAA", "9999A", "A9999",
]);

function isCodeBlacklisted(code) {
  return BLACKLISTED_CODES.has(code.toUpperCase());
}

function hasSequentialPattern(code) {
  // Detectar secuencias ascendentes o descendentes de 3+ caracteres
  const chars = "23456789ACDEFGHJKLMNPQRSTUWXYZ";
  for (let i = 0; i < code.length - 2; i++) {
    const idx1 = chars.indexOf(code[i]);
    const idx2 = chars.indexOf(code[i + 1]);
    const idx3 = chars.indexOf(code[i + 2]);
    
    if (idx1 !== -1 && idx2 !== -1 && idx3 !== -1) {
      // Secuencia ascendente
      if (idx2 === idx1 + 1 && idx3 === idx2 + 1) return true;
      // Secuencia descendente
      if (idx2 === idx1 - 1 && idx3 === idx2 - 1) return true;
    }
  }
  return false;
}

function hasRepetitivePattern(code) {
  // Detectar 3+ caracteres iguales consecutivos
  for (let i = 0; i < code.length - 2; i++) {
    if (code[i] === code[i + 1] && code[i] === code[i + 2]) {
      return true;
    }
  }
  return false;
}

function isValidRoomCode(code) {
  if (!code || code.length !== 5) return false;
  
  // Verificar lista negra
  if (isCodeBlacklisted(code)) return false;
  
  // Debe tener al menos 1 número y 1 letra
  const hasNumber = /[23456789]/.test(code);
  const hasLetter = /[ACDEFGHJKLMNPQRSTUWXYZ]/.test(code);
  if (!hasNumber || !hasLetter) return false;
  
  // No permitir patrones secuenciales obvios
  if (hasSequentialPattern(code)) return false;
  
  // No permitir patrones repetitivos
  if (hasRepetitivePattern(code)) return false;
  
  return true;
}

function generateRoomCode() {
  // Caracteres alfanuméricos sin confusión: sin O, 0, I, 1, V, B
  const chars = "23456789ACDEFGHJKLMNPQRSTUWXYZ";
  const numbers = "23456789";
  const letters = "ACDEFGHJKLMNPQRSTUWXYZ";
  
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    let code = "";
    
    // Asegurar al menos 1 número y 1 letra
    // Posiciones aleatorias para número y letra
    const numPos = Math.floor(Math.random() * 5);
    const letterPos = Math.floor(Math.random() * 5);
    
    for (let i = 0; i < 5; i++) {
      if (i === numPos) {
        code += numbers.charAt(Math.floor(Math.random() * numbers.length));
      } else if (i === letterPos) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
      } else {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    
    // Validar que el código sea seguro
    if (isValidRoomCode(code)) {
      return code;
    }
    
    attempts++;
  }
  
  // Fallback: código simple pero válido
  return letters.charAt(Math.floor(Math.random() * letters.length)) +
         numbers.charAt(Math.floor(Math.random() * numbers.length)) +
         chars.charAt(Math.floor(Math.random() * chars.length)) +
         chars.charAt(Math.floor(Math.random() * chars.length)) +
         chars.charAt(Math.floor(Math.random() * chars.length));
}

function sanitizeCode(input) {
  // Permitir solo caracteres alfanuméricos válidos (sin O, 0, I, 1, V, B)
  const validChars = "23456789ACDEFGHJKLMNPQRSTUWXYZ";
  return String(input)
    .trim()
    .toUpperCase()
    .split("")
    .filter(c => validChars.includes(c))
    .slice(0, 5)
    .join("");
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
  applyCompact(compactMode);
}
function applyCompact(on) {
  compactMode = on;
  filesList.classList.toggle("compact", on);
  const btn = document.getElementById("compact-btn");
  if (btn) btn.classList.toggle("active", on);
}
const mobileMq = window.matchMedia("(max-width: 600px)");
function handleMobileCompact(e) {
  if (e.matches) applyCompact(true);
}
mobileMq.addEventListener("change", handleMobileCompact);
if (mobileMq.matches) applyCompact(true);

const ENCRYPTED_TEXT_PREFIX = "enc-v1:";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isEncryptedTextPayload(value) {
  return typeof value === "string" && value.startsWith(ENCRYPTED_TEXT_PREFIX);
}

async function decodeTextPayload(value) {
  if (!isEncryptedTextPayload(value)) return value;
  return decryptText(value.slice(ENCRYPTED_TEXT_PREFIX.length), roomId);
}

async function hydrateTextDrop(li, payload) {
  if (!li) return;

  const textEl = li.querySelector(".drop-text-content");
  const copyBtn = li.querySelector(".copy-text-btn");
  if (!textEl || !copyBtn) return;

  try {
    const plainText = await decodeTextPayload(payload);
    const iconEl = li.querySelector(".drop-text-icon");

    textEl.innerHTML = escapeHtml(plainText);
    copyBtn.dataset.text = plainText;
    copyBtn.disabled = false;
    if (iconEl) iconEl.textContent = /^https?:\/\//i.test(plainText) ? "🔗" : "📋";
  } catch {
    textEl.textContent = "No se pudo descifrar este texto";
    copyBtn.disabled = true;
    copyBtn.dataset.text = "";
  }
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
// Todos los dispositivos usan serverNow() como fuente única de verdad.
// serverNow() = Date.now() + offset calibrado contra el servidor.

function getSecsLeft(expiresAt) {
  const now = serverNow();
  const expires = new Date(expiresAt).getTime();
  const diff = Math.max(0, Math.floor((expires - now) / 1000));
  
  // Debug en desarrollo
  if (window.location.hostname === 'localhost') {
    console.log(`⏰ Timer debug - Expires: ${new Date(expiresAt).toLocaleTimeString()}, Now: ${new Date(now).toLocaleTimeString()}, Remaining: ${diff}s`);
  }
  
  return diff;
}

function serverNow() {
  const offset = window.serverTimeOffset || 0;
  const now = Date.now() + offset;
  
  // Debug en desarrollo
  if (window.location.hostname === 'localhost' && Math.abs(offset) > 1000) {
    console.warn(`⚠️ Gran diferencia de tiempo con servidor: ${offset}ms`);
  }
  
  return now;
}

// Exponer funciones globalmente para debugging
window.getSecsLeft = getSecsLeft;
window.serverNow = serverNow;

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
    const s = n === 1 ? "" : "s";
    el.textContent = t('footerStats', {n: n.toLocaleString(window.i18n?.currentLang === 'es' ? 'es' : 'en'), s});
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
      return { ok: false, msg: `Límite de 2 GB por hora alcanzado.` };
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

// ─── Digit Input ───────────────────────────────────────────

function initDigitInput() {
  const boxes = Array.from(document.querySelectorAll(".digit-box"));
  const hiddenInput = document.getElementById("room-input");
  const validChars = "23456789ACDEFGHJKLMNPQRSTUWXYZ";

  function syncHidden() {
    hiddenInput.value = boxes.map(b => b.value).join("");
  }

  boxes.forEach((box, i) => {
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        if (box.value) {
          box.value = "";
          box.classList.remove("digit-filled");
          syncHidden();
        } else if (i > 0) {
          boxes[i - 1].focus();
          boxes[i - 1].value = "";
          boxes[i - 1].classList.remove("digit-filled");
          syncHidden();
        }
      } else if (e.key === "ArrowLeft" && i > 0) {
        boxes[i - 1].focus();
      } else if (e.key === "ArrowRight" && i < 4) {
        boxes[i + 1].focus();
      } else if (e.key === "Enter") {
        joinBtn.click();
      }
    });

    box.addEventListener("input", (e) => {
      const raw = e.target.value.toUpperCase();
      const lastChar = raw.slice(-1);
      if (lastChar && !validChars.includes(lastChar)) {
        showToast(t('toastInvalidChar', { char: lastChar }), "warn", 1500, true); // true = posición alta
      }
      const val = raw.split("").filter(c => validChars.includes(c)).slice(-1).join("");
      box.value = val;
      if (val) {
        box.classList.add("digit-filled");
        // Animación pop
        box.classList.remove("digit-pop");
        void box.offsetWidth;
        box.classList.add("digit-pop");
        // Avanzar al siguiente
        if (i < 4) boxes[i + 1].focus();
      } else {
        box.classList.remove("digit-filled");
      }
      syncHidden();
    });

    // Pegar código completo
    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData("text") || "").toUpperCase().split("").filter(c => validChars.includes(c)).slice(0, 5);
      pasted.forEach((ch, idx) => {
        if (boxes[idx]) {
          boxes[idx].value = ch;
          boxes[idx].classList.add("digit-filled");
        }
      });
      syncHidden();
      const nextEmpty = boxes.find(b => !b.value);
      (nextEmpty || boxes[4]).focus();
    });

    // Seleccionar todo al hacer focus
    box.addEventListener("focus", () => box.select());
  });
}

// ─── Slot Machine (odómetro / caja fuerte) ────────────────

function runSlotMachine(callback) {
  const btn = document.getElementById("new-room-btn");
  const boxes = Array.from(document.querySelectorAll(".digit-box"));
  const finalCode = generateRoomCode();
  const chars = finalCode.split("");
  const validChars = "23456789ACDEFGHJKLMNPQRSTUWXYZ";

  btn.disabled = true;

  const TOTAL_DURATION = 1400; // ms total de la animación
  const STAGGER        = 160;  // ms entre que cada dígito se detiene (de izq a der)
  const FPS            = 60;
  const FRAME_MS       = 1000 / FPS;

  // Para cada carácter: animar el valor que se muestra girando
  chars.forEach((finalChar, col) => {
    const box = boxes[col];
    if (!box) return;

    // Tiempo en que este carácter se detiene
    const stopAt = TOTAL_DURATION - (chars.length - 1 - col) * STAGGER;

    let currentIdx = Math.floor(Math.random() * validChars.length); // índice inicial aleatorio
    let startTime = null;
    let stopped = false;

    box.classList.add("digit-filled", "digit-spinning");

    function frame(ts) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;

      if (elapsed >= stopAt && !stopped) {
        // Parar en el carácter correcto
        stopped = true;
        box.value = finalChar;
        box.classList.remove("digit-spinning");
        // Pop de aterrizaje
        box.classList.remove("digit-pop");
        void box.offsetWidth;
        box.classList.add("digit-pop");
        haptic([6]);
        return;
      }

      if (!stopped) {
        // Velocidad: rápido al inicio, se frena al acercarse al stop
        const progress = elapsed / stopAt;
        // Intervalo entre cambios: empieza en 60ms, sube a 200ms al final
        const interval = FRAME_MS + progress * progress * 180;

        if (!box._lastChange || ts - box._lastChange >= interval) {
          currentIdx = (currentIdx + 1) % validChars.length;
          box.value = validChars[currentIdx];
          box._lastChange = ts;
        }

        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  });

  // Al terminar todo: restaurar botón y entrar a la sala
  setTimeout(() => {
    btn.disabled = false;
    document.getElementById("room-input").value = finalCode;
    // Limpiar propiedades temporales
    boxes.forEach(b => delete b._lastChange);
    callback(finalCode);
  }, TOTAL_DURATION + 100);
}

// ─── Sonido de sintonización ───────────────────────────────

function playPing() {
  // Crear un sonido de ping usando Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Fallback silencioso si Web Audio API no está disponible
    console.log("Ping sound not available");
  }
}

// ─── TTL Picker ────────────────────────────────────────────

let _pendingFiles = null;

function showTTLPicker(files) {
  if (!files || !files.length) return;
  _pendingFiles = files;
  const picker = document.getElementById("ttl-picker");
  picker.classList.remove("hidden");
  haptic([8]);
  setTimeout(() => picker.querySelector(".ttl-picker-btn")?.focus(), 50);
}

function hideTTLPicker() {
  const picker = document.getElementById("ttl-picker");
  const sheet = picker.querySelector(".ttl-picker-sheet");
  const backdrop = picker.querySelector(".ttl-picker-backdrop");
  sheet.style.animation = "sheet-out 0.22s cubic-bezier(0.4,0,0.2,1) forwards";
  backdrop.style.animation = "picker-fade-out 0.22s ease forwards";
  setTimeout(() => {
    picker.classList.add("hidden");
    sheet.style.animation = "";
    backdrop.style.animation = "";
  }, 220);
}

function initTTLPicker() {
  const picker = document.getElementById("ttl-picker");
  const burnCheckbox = document.getElementById("burn-after-reading");

  picker.querySelectorAll(".ttl-picker-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const secs = parseInt(btn.dataset.secs);
      TTL_SECONDS = secs;
      BURN_AFTER_READING = burnCheckbox?.checked || false;
      // Sincronizar con los TTL buttons del card
      document.querySelectorAll(".ttl-btn").forEach(b => {
        b.classList.toggle("active", parseInt(b.dataset.secs) === secs);
      });
      haptic([10, 20]);
      hideTTLPicker();
      setTimeout(() => {
        if (_pendingFiles) { uploadFiles(_pendingFiles); _pendingFiles = null; }
      }, 180);
    });
  });

  const cancel = () => {
    haptic([8]);
    hideTTLPicker();
    _pendingFiles = null;
    fileInput.value = "";
    if (burnCheckbox) burnCheckbox.checked = false;
  };

  picker.querySelector(".ttl-picker-cancel").addEventListener("click", cancel);
  picker.querySelector(".ttl-picker-backdrop").addEventListener("click", cancel);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !picker.classList.contains("hidden")) cancel();
  });
}

// ─── Skeleton loader ───────────────────────────────────────
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
function showUploadPreview(files, currentIndex = -1) {
  let preview = document.getElementById("upload-preview");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "upload-preview";
    progressWrap.parentNode.insertBefore(preview, progressWrap.nextSibling.nextSibling);
  }
  preview.innerHTML = "";
  Array.from(files).forEach((f, idx) => {
    const div = document.createElement("div");
    div.className = "upload-preview-item";
    div.dataset.index = idx;
    
    // Resaltar el archivo que se está subiendo
    if (idx === currentIndex) {
      div.classList.add("uploading-now");
    } else if (idx < currentIndex) {
      div.classList.add("uploaded");
    }
    
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
  const peopleLabel = window.i18n ? window.i18n.t('people') : 'personas';
  membersEl.innerHTML = `
    <div class="members-avatars">${avatarsHtml}${extra}</div>
    <span class="members-label">${membersCount} ${peopleLabel}</span>
  `;
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
function animateExpire(fileId, mode = "normal") {
  const li = document.querySelector(`li[data-id="${fileId}"]`);
  if (!li) return;
  if (mode === "burn") {
    haptic([12, 20, 12, 25]);
    li.classList.add("burn-exit-animation");
  } else {
    haptic([15, 30, 15]); // vibración al esfumarse
    li.classList.add("exit-animation");
  }
  setTimeout(() => {
    li.remove();
    updateDropCount();
  }, mode === "burn" ? 1500 : 900);
}


let toastTimer = null;
const dlProgress = document.getElementById("dl-progress");
const dlProgressText = document.getElementById("dl-progress-text");
const dlProgressTrack = document.getElementById("dl-progress-track");
const dlProgressBar = document.getElementById("dl-progress-bar");

function showToast(msg, type = "info", duration = 3000, high = false) {
  toastEl.textContent = msg;
  toastEl.className   = `toast toast-${type}`;
  if (high) toastEl.classList.add("toast-high");
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), duration);
}

function showDlProgress(pct, loaded, total) {
  dlProgressText.textContent = t('dlProgress', { loaded: formatBytes(loaded), total: formatBytes(total) });
  dlProgress.classList.remove("hidden");
  void dlProgress.offsetWidth;
  const trackWidth = dlProgressTrack.getBoundingClientRect().width;
  const w = Math.min(100, Math.max(0, pct));
  const px = Math.round((trackWidth * w) / 100);
  console.log(`📊 DL: ${w.toFixed(1)}%, track=${trackWidth}px, bar=${px}px, loaded=${formatBytes(loaded)}, total=${formatBytes(total)}`);
  dlProgressBar.style.width = px + "px";
}

function hideDlProgress() {
  dlProgress.classList.add("hidden");
  dlProgressBar.style.width = "0px";
}

// Compatibility aliases for cached code (temporary - can remove in v4.0)
window.hideToastProgress = hideDlProgress;
window.showToastProgress = showDlProgress;

// Helper para mensajes traducidos
function t(key, params = {}) {
  return window.i18n ? window.i18n.t(key, params) : key;
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
    console.log('🕐 Calibrando tiempo del servidor...');
    
    // Método 1: Intentar función RPC personalizada
    try {
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        const { data, error } = await db.rpc("get_server_time").single();
        const t1 = Date.now();
        if (!error && data) {
          const latency = (t1 - t0) / 2;
          const serverMs = new Date(data).getTime();
          samples.push(serverMs - (t0 + latency));
        }
      }
      if (samples.length) {
        samples.sort((a, b) => a - b);
        window.serverTimeOffset = samples[Math.floor(samples.length / 2)];
        console.log(`✅ Tiempo calibrado (RPC): ${window.serverTimeOffset}ms`);
        return;
      }
    } catch (rpcError) {
      console.log('⚠️ RPC get_server_time no disponible, usando método alternativo');
    }
    
    // Método 2: Usar timestamp de una consulta simple
    try {
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        const { data, error } = await db
          .from('rooms')
          .select('created_at')
          .limit(1)
          .order('created_at', { ascending: false });
        const t1 = Date.now();
        
        if (!error && data && data.length > 0) {
          const latency = (t1 - t0) / 2;
          // Asumir que el registro más reciente fue creado "ahora"
          const serverMs = new Date(data[0].created_at).getTime();
          const clientTime = t0 + latency;
          
          // Solo usar si la diferencia es razonable (menos de 1 hora)
          const diff = Math.abs(serverMs - clientTime);
          if (diff < 3600000) {
            samples.push(serverMs - clientTime);
          }
        }
      }
      
      if (samples.length) {
        samples.sort((a, b) => a - b);
        window.serverTimeOffset = samples[Math.floor(samples.length / 2)];
        console.log(`✅ Tiempo calibrado (DB): ${window.serverTimeOffset}ms`);
        return;
      }
    } catch (dbError) {
      console.warn('⚠️ No se pudo calibrar con DB:', dbError.message);
    }
    
    // Método 3: Sin calibración (usar tiempo local)
    window.serverTimeOffset = 0;
    console.log('⚠️ Usando tiempo local (sin calibración)');
    
  } catch (error) {
    console.error('❌ Error calibrando tiempo:', error);
    window.serverTimeOffset = 0;
  }
}

// ─── Room ──────────────────────────────────────────────────

async function joinRoom(code) {
  const clean = sanitizeCode(code);
  if (clean.length < 5) { 
    setStatus("Código de 5 caracteres", "error"); 
    return; 
  }
  
  // Validar que el código sea seguro
  if (!isValidRoomCode(clean)) {
    setStatus("Código no válido. Debe tener al menos 1 número y 1 letra, sin patrones obvios.", "error");
    return;
  }

  // Cerrar onboarding si está visible
  closeOnboarding();

  roomId = clean;
  addRecent(roomId);
  renderRecent();
  roomCodeDisp.textContent = `${t('room')} ${roomId}`;
  copyBtn.dataset.code = roomId;

  roomSection.classList.add("room-compact");
  show(roomBadge, dropSection, textSection, listSection);
  setStatus(t('statusConnecting'), "info");

  // Conexiones en paralelo para mayor velocidad
  await Promise.all([
    ensureRoom(roomId),
    cleanExpired(),
  ]);

  await loadFiles();
  subscribeToRoom();
  
  // Primero subscribirse a presence
  await subscribeToPresence();
  
  if (roomSyncTimer) clearInterval(roomSyncTimer);
  // Fallback por si Realtime DELETE no llega en algunos proyectos.
  roomSyncTimer = setInterval(() => {
    if (roomId) loadFiles({ showSkeletonLoader: false });
  }, 15000);
  setStatus(t('statusActive', {room: roomId}), "success");
}

function leaveRoom() {
  Object.keys(fileTimers).forEach(id => { clearInterval(fileTimers[id]); delete fileTimers[id]; });
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  if (presenceChannel) db.removeChannel(presenceChannel);
  realtimeChannel = null;
  presenceChannel = null;
  if (roomSyncTimer) { clearInterval(roomSyncTimer); roomSyncTimer = null; }
  burnedDropIds.clear();
  
  roomId = null;
  membersCount = 0;

  roomSection.classList.remove("room-compact");
  hide(roomBadge, dropSection, textSection, listSection);
  filesList.innerHTML = `
    <li class="empty-state">
      <span class="empty-ghost">${t('emptyGhost')}</span>
      <span class="empty-title">${t('emptyTitle')}</span>
      <span class="empty-sub">${t('emptySub')}</span>
    </li>`;
  roomInput.value = "";
  // Limpiar digit boxes
  document.querySelectorAll(".digit-box").forEach(b => {
    b.value = "";
    b.classList.remove("digit-filled");
  });
  dropCount.textContent = "";
  setStatus(t('statusNoRoom'), "info");
}

// ─── Supabase ──────────────────────────────────────────────

async function ensureRoom(id) {
  const { error } = await db.from("rooms")
    .upsert({ id, last_seen: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("ensureRoom:", error);
}

async function loadFiles({ showSkeletonLoader = true } = {}) {
  if (showSkeletonLoader) showSkeleton();
  const { data, error } = await db.from("drops")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (error) { console.error("loadFiles:", error); return; }
  renderDrops(data || []);
}

// ─── Render ────────────────────────────────────────────────

function getMimeFromName(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif",
    webp:"image/webp", svg:"image/svg+xml", mp4:"video/mp4", mov:"video/quicktime",
    avi:"video/x-msvideo", mkv:"video/x-matroska", mp3:"audio/mpeg",
    wav:"audio/wav", flac:"audio/flac", pdf:"application/pdf",
    doc:"application/msword", docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls:"application/vnd.ms-excel", xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip:"application/zip", rar:"application/x-rar-compressed",
    txt:"text/plain", md:"text/markdown", json:"application/json",
    js:"text/javascript", ts:"text/typescript", html:"text/html", css:"text/css",
  };
  return map[ext] || "application/octet-stream";
}

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

  const active = items.filter(f => getSecsLeft(f.expires_at) > 0 && !burnedDropIds.has(f.id));
  updateDropCount(active.length);

  if (!active.length) {
    filesList.innerHTML = `
      <li class="empty-state">
        <span class="empty-ghost">${t('emptyGhost')}</span>
        <span class="empty-title">${t('emptyTitle')}</span>
        <span class="empty-sub">${t('emptySub')}</span>
      </li>`;
    return;
  }

  active.forEach(f => {
    const li = buildDropEl(f);
    li.classList.add("drop-visible");
    filesList.appendChild(li);
    const secs = getSecsLeft(f.expires_at);
    const total = f.created_at
      ? Math.round((new Date(f.expires_at) - new Date(f.created_at)) / 1000)
      : TTL_SECONDS;
    startFileTimer(f.id, secs, total);
  });

  attachDropEvents(filesList);
}

function buildDropEl(f) {
  const secsLeft = getSecsLeft(f.expires_at);
  // TTL total: diferencia entre expires_at y created_at (si existe), o TTL_SECONDS
  const totalSecs = f.created_at
    ? Math.round((new Date(f.expires_at) - new Date(f.created_at)) / 1000)
    : TTL_SECONDS;
  const safeName = escapeHtml(f.file_name);
  const li = document.createElement("li");
  li.dataset.id = f.id;
  li.dataset.total = totalSecs; // guardar para el timer

  if (f.content_type === "text") {
    const encrypted = isEncryptedTextPayload(f.file_name);
    const previewText = encrypted ? "Descifrando..." : f.file_name;
    const isLink = !encrypted && /^https?:\/\//i.test(f.file_name);
    li.className = "drop-item drop-text";
    li.innerHTML = `
      <div class="drop-text-body">
        <span class="drop-text-icon">${isLink ? "🔗" : "📋"}</span>
        <span class="drop-text-content">${escapeHtml(previewText)}</span>
      </div>
      <div class="drop-meta">
        <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
        <button class="dl-btn copy-text-btn" data-text="${encrypted ? "" : f.file_name.replace(/"/g, "&quot;")}" ${encrypted ? "disabled" : ""}>Copiar</button>
      </div>
      <div class="ttl-bar-wrap"><div class="ttl-bar" id="bar-${f.id}"></div></div>`;
    if (encrypted) hydrateTextDrop(li, f.file_name);
  } else {
    const icon  = getFileIcon(f.file_name);
    const thumb = isImage(f.file_name) ? `<div class="thumb-wrap" id="thumb-${f.id}"></div>` : "";
    const previewBtn = isImage(f.file_name)
      ? `<button class="dl-btn preview-btn" data-id="${f.id}">👁</button>` : "";
    const burnBadge = f.burn_after_reading ? `<span class="burn-badge" title="Se borra después de 1 descarga">🔥</span>` : "";
    li.className = "drop-item drop-file";
    li.innerHTML = `
      ${thumb}
      <div class="drop-file-info">
        <span class="fname">${icon} ${safeName} ${burnBadge}</span>
        <span class="fsize">${formatBytes(f.file_size)}</span>
      </div>
      <div class="drop-meta">
        <span class="ftimer" id="t-${f.id}">${formatCountdown(secsLeft)}</span>
        ${previewBtn}
        <button class="dl-btn file-dl-btn"
          data-path="${f.storage_path}"
          data-id="${f.id}"
          data-name="${f.file_name}"
          data-type="${f.content_type || 'application/octet-stream'}"
          data-size="${f.file_size || 0}"
          data-burn="${f.burn_after_reading || false}"
          data-storage="${f.storage || 'supabase'}"
          data-b2-key="${f.b2_key || ''}">↓</button>
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
      // Feedback visual inmediato — el botón se vuelve verde con ✓
      const origHTML = btn.innerHTML;
      btn.innerHTML = "✓";
      btn.classList.add("dl-success");
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = origHTML;
        btn.classList.remove("dl-success");
        btn.disabled = false;
      }, 1500);
      addToDownloadQueue(
        btn.dataset.path,
        btn.dataset.id,
        btn.dataset.name,
        btn.dataset.type,
        btn.dataset.burn === "true",
        btn.dataset.storage || "supabase",
        btn.dataset.b2Key || null,
        parseInt(btn.dataset.size) || 0
      ).catch(err => {
        showToast(`Error: ${err.message}`, "error");
        btn.innerHTML = origHTML;
        btn.classList.remove("dl-success");
        btn.disabled = false;
      });
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
    let data;
    
    if (f.storage === "b2") {
      // Descargar de Backblaze B2
      data = await downloadFromB2(f.b2_key || f.storage_path);
    } else {
      // Descargar de Supabase
      const { data: supabaseData } = await db.storage.from("ghost-drop").download(f.storage_path);
      if (!supabaseData) return;
      data = supabaseData;
    }
    
    // Descifrar la imagen
    const decryptedBlob = await decryptFile(data, roomId, f.content_type || "image/jpeg");
    
    const wrap = li.querySelector(`#thumb-${f.id}`);
    if (!wrap) return;
    const url = URL.createObjectURL(decryptedBlob);
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
  // Limpiar timer existente
  if (fileTimers[fileId]) { 
    clearInterval(fileTimers[fileId]); 
    delete fileTimers[fileId]; 
  }
  
  if (secs <= 0) {
    console.log(`⏰ Timer ${fileId}: Ya expirado (${secs}s)`);
    return;
  }
  
  const total = totalSecs ?? secs;
  let remaining = secs;
  
  console.log(`⏰ Iniciando timer ${fileId}: ${remaining}s de ${total}s`);

  const el = document.getElementById(`t-${fileId}`);
  if (el) { 
    el.textContent = formatCountdown(remaining); 
    updateTimerColor(el, remaining, total); 
  }

  // Barra inicial sincronizada con el porcentaje real
  const bar = document.getElementById(`bar-${fileId}`);
  if (bar) {
    const pct = Math.max(0, (remaining / total) * 100);
    // Sin transición para el valor inicial — evita animación desde 100%
    bar.style.transition = "none";
    bar.style.width = pct + "%";
    // Forzar reflow y activar transición fluida
    bar.getBoundingClientRect();
    bar.style.transition = "width 1s linear";
  }

  // rAF para actualizar la barra a 60fps
  const startTime = performance.now();
  const startRemaining = remaining;
  let rafId = null;

  function rafBar() {
    const b = document.getElementById(`bar-${fileId}`);
    if (!b) {
      if (rafId) cancelAnimationFrame(rafId);
      return;
    }
    const elapsed = (performance.now() - startTime) / 1000;
    const current = Math.max(0, startRemaining - elapsed);
    b.style.width = Math.max(0, (current / total) * 100) + "%";
    if (current > 0) {
      rafId = requestAnimationFrame(rafBar);
    }
  }
  rafId = requestAnimationFrame(rafBar);

  // Timer principal que actualiza cada segundo
  fileTimers[fileId] = setInterval(() => {
    remaining--;
    const el = document.getElementById(`t-${fileId}`);
    if (!el) { 
      console.log(`⏰ Timer ${fileId}: Elemento no encontrado, limpiando`);
      clearInterval(fileTimers[fileId]); 
      delete fileTimers[fileId]; 
      if (rafId) cancelAnimationFrame(rafId);
      return; 
    }
    
    updateTimerColor(el, remaining, total);

    // Parpadeo en los últimos 10 segundos
    if (remaining <= 10 && remaining > 0) {
      el.classList.add("timer-blink");
    }

    if (remaining <= 0) {
      // Muerte instantánea — dispara animación sin mostrar 00:00
      console.log(`⏰ Timer ${fileId}: Expirado, animando salida`);
      clearInterval(fileTimers[fileId]);
      delete fileTimers[fileId];
      if (rafId) cancelAnimationFrame(rafId);
      animateExpire(fileId, "normal");
    } else {
      el.textContent = formatCountdown(remaining);
    }
  }, 1000);
}

function updateDropCount(n) {
  const count = n ?? filesList.querySelectorAll("li:not(.empty):not(.empty-state)").length;
  const el = dropCount;
  const prev = el.textContent;
  const next = count ? `· ${count}` : "";
  el.textContent = next;
  const sideEl = document.getElementById("drop-count-side");
  if (sideEl) sideEl.textContent = count;
  
  // Mostrar/ocultar botón "Descargar todo"
  const downloadAllBtn = document.getElementById("download-all-btn");
  if (downloadAllBtn) {
    if (count >= 2) {
      downloadAllBtn.classList.remove("hidden");
    } else {
      downloadAllBtn.classList.add("hidden");
    }
  }
  
  if (count === 0) {
    filesList.innerHTML = `
      <li class="empty-state">
        <span class="empty-ghost">${t('emptyGhost')}</span>
        <span class="empty-title">${t('emptyTitle')}</span>
        <span class="empty-sub">${t('emptySub')}</span>
      </li>`;
  }
  // Pop animation cuando el número cambia
  if (prev !== next && count > 0) {
    el.classList.remove("drop-count-pop");
    void el.offsetWidth; // reflow
    el.classList.add("drop-count-pop");
  }
}

// ─── Upload con progreso real via XHR ─────────────────────

function uploadWithProgress(url, file, headers) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    let startTime = Date.now();
    const speedSamples = []; // Para promedio móvil
    const MAX_SAMPLES = 5;

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      const pct = (e.loaded / e.total) * 100;
      // Lerp suave — nunca superar 95% hasta confirmar
      const display = Math.min(pct * 0.95, 95);
      progressBar.style.width = display + "%";
      
      // Calcular velocidad promedio (más estable)
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // segundos totales
      
      // Solo calcular después de 1 segundo para evitar valores locos
      if (elapsed > 1) {
        const instantSpeed = e.loaded / elapsed;
        speedSamples.push(instantSpeed);
        
        // Mantener solo las últimas N muestras
        if (speedSamples.length > MAX_SAMPLES) {
          speedSamples.shift();
        }
        
        // Velocidad promedio
        const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
        const remaining = (e.total - e.loaded) / avgSpeed;
        
        setProgressLabel(e.loaded, e.total, avgSpeed, remaining);
      } else {
        // Primeros segundos: solo mostrar bytes
        setProgressLabel(e.loaded, e.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText || "{}"));
      } else {
        // Intentar parsear el mensaje de error de Supabase
        let msg = `HTTP ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.error || body.message || msg;
        } catch {}
        reject(new Error(msg));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.send(file);
  });
}

// ─── Storage selection ─────────────────────────────────────

async function selectStorage(fileSize) {
  const SUPABASE_MAX = 50 * 1024 * 1024; // 50 MB
  const B2_MAX = 250 * 1024 * 1024; // 250 MB
  
  if (fileSize > B2_MAX) {
    throw new Error(`Archivo muy grande. Máximo: ${formatBytes(B2_MAX)}`);
  }
  
  if (fileSize > SUPABASE_MAX) {
    const available = await testB2Connection();
    if (!available) throw new Error(t('toastB2Disabled'));
    return "b2";
  }
  
  return "supabase";
}

// ─── Upload ────────────────────────────────────────────────

async function uploadFiles(files) {
  if (!roomId) { showToast(t('toastJoinFirst'), "error"); return; }
  let uploaded = 0;
  const filesArray = Array.from(files);

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    if (file.size === 0) {
      showToast(`❌ ${file.name} está vacío`, "error");
      continue;
    }

    // Validar tamaño ANTES de cifrar
    const MAX_SIZE = 250 * 1024 * 1024; // 250MB
    if (file.size > MAX_SIZE) {
      showToast(t('toastFileTooLarge', { file: file.name, size: formatBytes(file.size) }), "error");
      continue;
    }

    // Determinar qué storage usar
    let storage;
    try {
      storage = await selectStorage(file.size);
      console.log(`📁 Archivo ${file.name} (${formatBytes(file.size)}) → ${storage.toUpperCase()}`);
    } catch (err) {
      showToast(err.message, "error");
      continue;
    }

    const rl = checkRateLimit("file", file.size);
    if (!rl.ok) { showToast(rl.msg, "error"); break; }
    recordRateLimit("file", file.size);

    // ── UI inicial ────────────────────────────────────────
    progressWrap.style.display = "block";
    progressBar.classList.remove("progress-indeterminate", "progress-pulse");
    progressBar.style.width = "0%";
    setProgressLabel(0, file.size);
    showToast(t('toastEncrypting', {file: file.name.slice(0, 20)}), "info");
    showUploadPreview(filesArray, i); // Resaltar archivo actual
    dropzone.classList.add("uploading");

    // ── Cifrar archivo ────────────────────────────────────
    let encryptedFile;
    try {
      const { blob } = await encryptFile(file, roomId);
      encryptedFile = blob;
      showToast(t('toastUploading', {file: file.name.slice(0, 20)}), "info");
    } catch (err) {
      progressWrap.style.display = "none";
      setProgressLabel(0, 0);
      dropzone.classList.remove("uploading");
      showToast(`Error cifrando: ${err.message}`, "error");
      continue;
    }

    let path, b2Key;
    let upErr = null;

    // ── SUBIR A SUPABASE O B2 ─────────────────────────────
    if (storage === "supabase") {
      // Subir a Supabase
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      path = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const uploadUrl = `${window.SUPABASE_URL}/storage/v1/object/ghost-drop/${path}`;

      try {
        await uploadWithProgress(uploadUrl, encryptedFile, {
          "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}`,
          "x-upsert": "true",
          "Content-Type": "application/octet-stream",
          "Cache-Control": "3600",
        });
      } catch (e) {
        upErr = e;
      }
    } else {
      // Subir a Backblaze B2 DIRECTAMENTE con progreso REAL
      try {
        // Remover animación de pulso y transiciones
        progressBar.classList.remove("progress-pulse");
        progressBar.style.transition = "none";
        
        const startTime = Date.now();
        const speedSamples = [];
        const MAX_SAMPLES = 5;
        
        const result = await uploadToB2(encryptedFile, file.name, (loaded, total, speed, remaining) => {
          // Progreso REAL de subida directa a B2 (0-90%)
          const pct = (loaded / total) * 90;
          progressBar.style.width = pct + "%";
          
          // Mostrar bytes reales con velocidad y tiempo restante
          setProgressLabel(loaded, total, speed, remaining);
        });
        
        path = result.key;
        b2Key = result.key;
        
        progressBar.style.width = "90%";
        const label = document.getElementById("progress-label");
        if (label) {
          label.textContent = t('progressSaving');
        }
      } catch (e) {
        // Mensajes de error amigables
        let errorMsg = t('errorUpload');
        if (e.message.includes("413") || e.message.includes("too large") || e.message.includes("PayloadTooLargeError")) {
          errorMsg = t('errorTooLarge');
        } else if (e.message.includes("network") || e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
          errorMsg = t('errorConnection');
        } else if (e.message.includes("timeout") || e.message.includes("TimeoutError")) {
          errorMsg = t('errorTimeout');
        } else if (e.message.includes("CORS") || e.message.includes("cors")) {
          errorMsg = t('errorCors');
        } else if (e.message.includes("401") || e.message.includes("403")) {
          errorMsg = t('errorAuth');
        } else if (e.message.includes("500") || e.message.includes("502") || e.message.includes("503")) {
          errorMsg = "Servidor temporalmente no disponible. Intenta más tarde";
        }
        upErr = new Error(errorMsg);
      }
    }

    if (upErr) {
      progressWrap.style.display = "none";
      setProgressLabel(0, 0);
      dropzone.classList.remove("uploading");
      showToast(`Error: ${upErr.message}`, "error");
      continue;
    }

    // ── Procesando en servidor ────────────────────────────
    progressBar.style.width = "95%";
    const labelEl = document.getElementById("progress-label");
    if (labelEl) labelEl.textContent = "Finalizando...";

    const expiresAt = new Date(serverNow() + TTL_SECONDS * 1000).toISOString();
    const insertPayload = {
      room_id: roomId,
      file_name: file.name,
      file_size: file.size,
      storage_path: path,
      storage: storage,
      expires_at: expiresAt,
      content_type: file.type || getMimeFromName(file.name),
      burn_after_reading: BURN_AFTER_READING,
    };

    if (storage === "b2" && b2Key) {
      insertPayload.b2_key = b2Key;
    }

    const { error: dbErr, data: insertData } = await db.from("drops").insert(insertPayload).select("id").single();

    if (dbErr) {
      if (storage === "supabase") {
        await db.storage.from("ghost-drop").remove([path]);
      } else if (b2Key) {
        await deleteFromB2(b2Key);
      }
      progressWrap.style.display = "none";
      progressBar.classList.remove("progress-pulse");
      dropzone.classList.remove("uploading");
      showToast(`Error BD: ${dbErr.message}`, "error");
      continue;
    }

    if (insertData?.id) {
      myRecentDrops.set(insertData.id, TTL_SECONDS);
      prependDrop({
        id: insertData.id, room_id: roomId,
        file_name: file.name, file_size: file.size,
        storage_path: path, storage: storage,
        b2_key: b2Key,
        expires_at: expiresAt, content_type: file.type || getMimeFromName(file.name),
        burn_after_reading: BURN_AFTER_READING,
      });
    }
    incrementTotalUploads();

    // ── 100% y cierre ─────────────────────────────────────
    progressBar.classList.remove("progress-pulse");
    progressBar.style.width = "100%";
    setProgressLabel(1, file.size);
    uploaded++;
    await new Promise(r => setTimeout(r, 450));
    progressWrap.style.display = "none";
    setProgressLabel(0, 0);
    dropzone.classList.remove("uploading");
    clearUploadPreview();
  }

  if (uploaded) {
    // dropzone.classList.add("dropzone-collapsed"); // Desactivado: mantener tamaño fijo del dropzone
    showToast(t('toastUploaded', { n: uploaded }), "success");
    const listSection = document.getElementById("list-section");
    if (listSection) listSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setProgressLabel(loaded, total, speed = null, remaining = null) {
  const label = document.getElementById("progress-label");
  if (!label) return;
  if (!total) { label.textContent = ""; return; }
  
  let text = `${formatBytes(loaded)} / ${formatBytes(total)}`;
  
  // Solo mostrar velocidad (sin tiempo estimado)
  if (speed && speed > 0) {
    text += ` · ${formatSpeed(speed)}`;
  }
  
  label.textContent = text;
}

// ─── Texto ─────────────────────────────────────────────────

async function sendText() {
  const text = textInput.value.trim();
  if (!text || !roomId) return;

  const rl = checkRateLimit("text");
  if (!rl.ok) { showToast(rl.msg, "error"); return; }
  recordRateLimit("text");
  let encryptedText;
  try {
    encryptedText = await encryptText(text, roomId);
  } catch (err) {
    showToast(`Error cifrando: ${err.message}`, "error");
    return;
  }
  const expiresAt = new Date(serverNow() + TTL_SECONDS * 1000).toISOString();
  const { error, data: insertData } = await db.from("drops").insert({
    room_id: roomId, file_name: `${ENCRYPTED_TEXT_PREFIX}${encryptedText}`, file_size: text.length,
    storage_path: "", expires_at: expiresAt, content_type: "text",
  }).select("id").single();
  if (error) { showToast(`Error: ${error.message}`, "error"); return; }
  // Registrar TTL exacto para el timer local
  if (insertData?.id) myRecentDrops.set(insertData.id, TTL_SECONDS);
  textInput.value = "";
  showToast(t('toastTextShared'), "success");
}

// ─── Download Queue System ────────────────────────────────
let downloadQueue = [];
let isDownloading = false;

async function addToDownloadQueue(storagePath, dropId, fileName, contentType, burnAfterReading, storage, b2Key, fileSize) {
  return new Promise((resolve, reject) => {
    downloadQueue.push({
      storagePath, dropId, fileName, contentType, burnAfterReading, storage, b2Key, fileSize,
      resolve, reject
    });
    
    // Mostrar notificación si hay descargas en cola
    if (downloadQueue.length > 1) {
      showToast(t('toastDownloadQueued', { n: downloadQueue.length - 1 }), "info", 2000);
    }
    
    processDownloadQueue();
  });
}

async function processDownloadQueue() {
  if (isDownloading || downloadQueue.length === 0) return;
  
  isDownloading = true;
  const download = downloadQueue.shift();
  
  try {
    await downloadAndDestroy(
      download.storagePath,
      download.dropId,
      download.fileName,
      download.contentType,
      download.burnAfterReading,
      download.storage,
      download.b2Key,
      download.fileSize
    );
    download.resolve();
  } catch (error) {
    download.reject(error);
  } finally {
    isDownloading = false;
    // Procesar siguiente descarga en la cola
    if (downloadQueue.length > 0) {
      setTimeout(processDownloadQueue, 500); // Pequeña pausa entre descargas
    }
  }
}

// ─── Download ──────────────────────────────────────────────

async function downloadAndDestroy(storagePath, dropId, fileName, contentType = "application/octet-stream", burnAfterReading = false, storage = "supabase", b2Key = null, fileSize = 0) {
  const startTime = Date.now();
  
  showToast(t('toastDownloadingSimple', { n: 1, total: '' }), "info");

  console.log(`📥 Descargando: storage=${storage}, fileSize=${fileSize}, path=${storagePath}`);

  showDlProgress(0, 0, fileSize || 1);

  try {
    let data;

    if (storage === "b2") {
      data = await downloadFromB2(b2Key || storagePath, (loaded, total, percent, speed) => {
        const t = total || fileSize;
        const actualPercent = t > 0 ? Math.round((loaded / t) * 100) : 0;
        if (t > 0) showDlProgress(actualPercent, loaded, t);
        else dlProgressText.textContent = t('dlProgressSimple', { loaded: formatBytes(loaded) });
      });

      hideDlProgress();
      const downloadTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Descarga B2 completada en ${downloadTime}s`);

    } else {
      const downloadUrl = `${window.SUPABASE_URL}/storage/v1/object/ghost-drop/${storagePath}`;

      const response = await fetch(downloadUrl, {
        headers: { "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}` }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = parseInt(response.headers.get("Content-Length") || fileSize) || 0;
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (contentLength > 0) {
          const pct = Math.min(100, (receivedLength / contentLength) * 100);
          showDlProgress(pct, receivedLength, contentLength);
        } else {
          dlProgressText.textContent = t('dlProgressSimple', { loaded: formatBytes(receivedLength) });
        }
      }

      hideDlProgress();
      data = new Blob(chunks, { type: "application/octet-stream" });
    }

    showToast(t('toastDecrypting'), "info");
    
    let decryptedBlob;
    try {
      decryptedBlob = await decryptFile(data, roomId, contentType);
    } catch (err) {
      showToast(t('toastErrorDecrypt', { error: err.message }), "error");
      return;
    }

    // Guardar archivo
    const url = URL.createObjectURL(decryptedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`🎉 Descarga completa en ${totalTime}s total`);

    haptic([10, 50, 10]);
    recordDownload(fileName, roomId);

    if (burnAfterReading) {
      showToast(t('toastBurning'), "info");
      burnedDropIds.add(dropId);
      const { error: delErr } = await db.from("drops").delete().eq("id", dropId);
      
      if (storage === "b2" && b2Key) {
        await deleteFromB2(b2Key);
      } else {
        const { error: storageErr } = await db.storage.from("ghost-drop").remove([storagePath]);
        if (storageErr) {
          console.error("burn delete storage:", storageErr);
        }
      }
      
      if (delErr) {
        console.error("burn delete db:", delErr);
      }
      
      realtimeChannel?.send({
        type: "broadcast",
        event: "burn-delete",
        payload: { id: dropId },
      }).catch(() => {});
      clearInterval(fileTimers[dropId]);
      delete fileTimers[dropId];
      animateExpire(dropId, "burn");
      showToast(t('toastDownloadedBurned'), "success");
    } else {
      showToast(t('toastDownloadComplete', { file: fileName }), "success");
    }

  } catch (e) {
    hideDlProgress();
    console.error('❌ Error en descarga:', e);
    showToast(t('toastErrorDownload', { error: e.message }), "error");
  }
}

// ─── Realtime drops ────────────────────────────────────────

// Guarda el ID del drop que acabamos de subir nosotros mismos
// para arrancar su timer con TTL exacto en vez de expires_at del servidor
const myRecentDrops = new Map(); // id → ttlSeconds

function subscribeToRoom() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db
    .channel(`drops-${roomId}`)
    .on("broadcast", { event: "burn-delete" }, ({ payload }) => {
      const id = payload?.id;
      if (!id) return;
      burnedDropIds.add(id);
      clearInterval(fileTimers[id]);
      delete fileTimers[id];
      animateExpire(id, "burn");
    })
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "drops", filter: `room_id=eq.${roomId}` },
      ({ new: f }) => {
        if (!f || getSecsLeft(f.expires_at) <= 0) return;
        if (burnedDropIds.has(f.id)) return;
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
  // Limpiar empty state si existe
  filesList.querySelector(".empty-state")?.remove();
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

async function subscribeToPresence() {
  if (presenceChannel) db.removeChannel(presenceChannel);

  const userId = Math.random().toString(36).slice(2);

  presenceChannel = db.channel(`presence-${roomId}`, {
    config: { presence: { key: userId } },
  });

  return new Promise((resolve) => {
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
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            typing: false,
          });
          resolve();
        }
      });

    // Timeout: resolve anyway after 5s to prevent hanging UI
    setTimeout(() => {
      console.warn("Presence subscribe timed out, proceeding anyway");
      resolve();
    }, 5000);
  });
}

// ─── Notificaciones ────────────────────────────────────────

function notifyNewDrop(name, type) {
  const label = type === "text" ? "texto" : "archivo";
  const previewName = type === "text" && isEncryptedTextPayload(name)
    ? "mensaje cifrado"
    : name.slice(0, 28);
  showToast(`Nuevo ${label}: ${previewName}`, "info");

  if (Notification.permission === "granted" && document.hidden) {
    new Notification("Ghost Drop", {
      body: `Nuevo ${label} en sala ${roomId}`,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👻</text></svg>",
    });
  }
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
    new QRCode(qrCanvas, {
      text: url,
      width: 220,
      height: 220,
      colorDark:  "#ffffff",
      colorLight: "#1c1c1e",
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (err) {
    qrCanvas.textContent = `Sala: ${roomId}`;
    console.warn("QR error:", err);
  }
  show(qrModal);
}


// ─── Limpieza expirados ────────────────────────────────────

async function cleanExpired({ silent = true } = {}) {
  if (!roomId) return { deleted: 0, storageFiles: 0 };
  // Usar serverNow() con margen de 5s — evita borrar por desincronización residual
  const { data, error } = await db.from("drops")
    .select("id, storage_path, content_type, storage, b2_key")
    .eq("room_id", roomId)
    .lt("expires_at", new Date(serverNow() - 5000).toISOString());
  if (error) {
    console.error("cleanExpired select:", error);
    if (!silent) showToast(`No se pudo limpiar: ${error.message}`, "error");
    return { deleted: 0, storageFiles: 0, error };
  }
  if (!data?.length) {
    if (!silent) showToast("No hay expirados pendientes en esta sala", "info");
    return { deleted: 0, storageFiles: 0 };
  }
  
  // Separar archivos de Supabase y B2
  const supabasePaths = data.filter(d => d.content_type !== "text" && d.storage_path && d.storage !== "b2").map(d => d.storage_path);
  const b2Keys = data.filter(d => d.storage === "b2" && d.b2_key).map(d => d.b2_key);
  
  // Borrar archivos de Supabase
  if (supabasePaths.length) {
    const { error: storageErr } = await db.storage.from("ghost-drop").remove(supabasePaths);
    if (storageErr) {
      console.warn("cleanExpired storage:", storageErr);
      if (!silent) showToast(`Storage no limpió todo: ${storageErr.message}`, "warn");
    }
  }
  
  // Borrar archivos de B2
  if (b2Keys.length) {
    for (const key of b2Keys) {
      try {
        await deleteFromB2(key);
      } catch (err) {
        console.warn(`cleanExpired B2 (${key}):`, err);
      }
    }
  }
  
  const { error: deleteErr } = await db.from("drops").delete().in("id", data.map(d => d.id));
  if (deleteErr) {
    console.error("cleanExpired delete:", deleteErr);
    if (!silent) showToast(`BD no limpió todo: ${deleteErr.message}`, "error");
    return { deleted: 0, storageFiles: supabasePaths.length + b2Keys.length, error: deleteErr };
  }
  if (!silent) showToast(`Limpieza local: ${data.length} registro(s), ${supabasePaths.length + b2Keys.length} archivo(s)`, "success");
  return { deleted: data.length, storageFiles: supabasePaths.length + b2Keys.length };
}

// Limpieza global de archivos expirados (todas las salas)
async function cleanExpiredGlobal() {
  try {
    const { data, error } = await db.from("drops")
      .select("id, storage_path, content_type, storage, b2_key")
      .lt("expires_at", new Date(Date.now() - 5000).toISOString());
    
    if (error) {
      console.error("cleanExpiredGlobal select:", error);
      return;
    }
    
    if (!data?.length) {
      return;
    }
    
    // Separar archivos de Supabase y B2
    const supabasePaths = data.filter(d => d.content_type !== "text" && d.storage_path && d.storage !== "b2").map(d => d.storage_path);
    const b2Keys = data.filter(d => d.storage === "b2" && d.b2_key).map(d => d.b2_key);
    
    // Borrar archivos de Supabase
    if (supabasePaths.length) {
      const { error: storageErr } = await db.storage.from("ghost-drop").remove(supabasePaths);
      if (storageErr) {
        console.warn("cleanExpiredGlobal storage:", storageErr);
      }
    }
    
    // Borrar archivos de B2
    if (b2Keys.length) {
      for (const key of b2Keys) {
        try {
          await deleteFromB2(key);
        } catch (err) {
          console.warn(`cleanExpiredGlobal B2 (${key}):`, err);
        }
      }
    }
    
    // Borrar registros de la BD
    const { error: deleteErr } = await db.from("drops").delete().in("id", data.map(d => d.id));
    if (deleteErr) {
      console.error("cleanExpiredGlobal delete:", deleteErr);
    }
  } catch (err) {
    console.error("cleanExpiredGlobal error:", err);
  }
}

// ─── Eventos ───────────────────────────────────────────────

// Drag & Drop en toda la ventana
let dragCounter = 0;

window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (roomId && e.dataTransfer.types.includes("Files")) {
    dragCounter++;
    // dropzone.classList.remove("dropzone-collapsed"); // Ya no es necesario
    dropzone.classList.add("drag-over");
    dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    dropzone.classList.remove("drag-over");
  }
});

window.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (roomId && e.dataTransfer.types.includes("Files")) {
    e.dataTransfer.dropEffect = "copy";
  }
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropzone.classList.remove("drag-over");
  
  if (roomId && e.dataTransfer.files.length > 0) {
    showTTLPicker(e.dataTransfer.files);
  } else if (!roomId) {
    showToast(t('toastJoinFirst'), "error");
  }
});

// Eventos específicos del dropzone
dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", e => {
  e.preventDefault(); dropzone.classList.remove("drag-over");
  if (roomId) showTTLPicker(e.dataTransfer.files);
  else showToast(t('toastJoinFirst'), "error");
});
dropzone.addEventListener("click", () => { fileInput.click(); });
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) showTTLPicker(fileInput.files);
});

joinBtn.addEventListener("click", () => {
  const code = sanitizeCode(roomInput.value);
  if (code.length < 5) { setStatus("Código de 5 caracteres", "error"); return; }
  joinRoom(code);
});
roomInput.addEventListener("keydown", e => { if (e.key === "Enter") joinBtn.click(); });
roomInput.addEventListener("input", () => {
  roomInput.value = roomInput.value.replace(/[^0-9]/g, "").slice(0, 6);
});
newBtn.addEventListener("click", () => runSlotMachine((code) => joinRoom(code)));

copyBtn.addEventListener("click", () => {
  const url = `${location.origin}${location.pathname}?room=${copyBtn.dataset.code}`;
  navigator.clipboard.writeText(url).then(() => {
    haptic();
    showToast(t('toastLinkCopied'), "success");
    copyBtn.textContent = t('toastCopied');
    setTimeout(() => copyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span data-i18n="copyBtn">${t('copyBtn')}</span>`, 2000);
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

// ─── Descargar todo como ZIP ───────────────────────────────

async function downloadAllAsZip() {
  if (!window.JSZip) {
    showToast(t('errorJSZip'), "error");
    return;
  }

  const items = filesList.querySelectorAll("li:not(.empty-state)");
  const files = Array.from(items)
    .map(li => {
      const btn = li.querySelector(".file-dl-btn");
      if (!btn) return null;
      return {
        path: btn.dataset.path,
        name: btn.dataset.name,
        type: btn.dataset.type || "application/octet-stream",
        id: btn.dataset.id,
        burn: btn.dataset.burn === "true",
        storage: btn.dataset.storage || "supabase",
        b2Key: btn.dataset.b2Key || null
      };
    })
    .filter(Boolean);

  if (files.length === 0) {
    showToast(t('toastNoFilesToDownload'), "info");
    return;
  }

  showToast(t('toastDownloading', { n: files.length, total: '' }), "info");
  const zip = new JSZip();
  let downloaded = 0;
  const filesToBurn = []; // Archivos con burn after reading

  for (const file of files) {
    try {
      let data;

      if (file.storage === "b2") {
        // Descargar desde B2/R2
        if (!file.b2Key) {
          console.error(`Error downloading ${file.name}: missing b2Key`);
          continue;
        }
        data = await downloadFromB2(file.b2Key);
      } else {
        // Descargar desde Supabase
        const { data: sbData, error } = await db.storage
          .from("ghost-drop")
          .download(file.path);

        if (error || !sbData) {
          console.error(`Error downloading ${file.name}:`, error);
          continue;
        }
        data = sbData;
      }

      // Descifrar
      const decryptedBlob = await decryptFile(data, roomId, file.type);
      
      // Agregar al ZIP
      zip.file(file.name, decryptedBlob);
      downloaded++;
      
      // Si tiene burn after reading, agregarlo a la lista para borrar
      if (file.burn) {
        filesToBurn.push(file);
      }
      
      showToast(t('toastDownloading', { n: downloaded, total: files.length }), "info");
    } catch (err) {
      console.error(`Error procesando ${file.name}:`, err);
    }
  }

  if (downloaded === 0) {
    showToast(t('toastNoFiles'), "error");
    return;
  }

  // Generar ZIP
  showToast(t('toastGeneratingZip'), "info");
  const zipBlob = await zip.generateAsync({ type: "blob" });

  // Descargar
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ghost-drop-${roomId}-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Borrar archivos con burn after reading
  if (filesToBurn.length > 0) {
    showToast(`Borrando ${filesToBurn.length} archivo(s) con burn after reading…`, "info");
    
    for (const file of filesToBurn) {
      try {
        // Marcar como borrado localmente
        burnedDropIds.add(file.id);
        
        // Borrar de la base de datos
        const { error: delErr } = await db.from("drops").delete().eq("id", file.id);
        if (delErr) {
          console.error("burn delete db:", delErr);
        }
        
        // Borrar del storage
        if (file.storage === "b2" && file.b2Key) {
          await deleteFromB2(file.b2Key);
        } else {
          const { error: storageErr } = await db.storage.from("ghost-drop").remove([file.path]);
          if (storageErr) {
            console.error("burn delete storage:", storageErr);
          }
        }
        
        // Notificar a otros usuarios
        realtimeChannel?.send({
          type: "broadcast",
          event: "burn-delete",
          payload: { id: file.id },
        }).catch(() => {});
        
        // Limpiar timer y animar
        clearInterval(fileTimers[file.id]);
        delete fileTimers[file.id];
        animateExpire(file.id, "burn");
      } catch (err) {
        console.error(`Error borrando ${file.name}:`, err);
      }
    }
  }

  haptic([10, 50, 10]);
  const burnMsg = filesToBurn.length > 0 ? ` (${filesToBurn.length} borrado(s))` : "";
  showToast(t('toastDownloaded', { n: downloaded, burn: burnMsg }), "success");
}

// ─── Onboarding (primera visita) ──────────────────────────

function initOnboarding() {
  const ONBOARDING_KEY = "ghostdrop-onboarding-seen";
  const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
  
  if (!hasSeenOnboarding) {
    // Mostrar tooltip casi inmediatamente (50ms para que el DOM se estabilice)
    setTimeout(() => {
      const tooltip = document.getElementById("onboarding-tooltip");
      if (tooltip && !roomId) { // Solo si no está en una sala
        tooltip.classList.remove("hidden");
        haptic([8]);
      }
    }, 50);
    
    // Cerrar tooltip con botón X
    const closeBtn = document.getElementById("onboarding-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeOnboarding();
      });
    }
    
    // Cerrar tooltip con botón CTA
    const ctaBtn = document.getElementById("onboarding-cta");
    if (ctaBtn) {
      ctaBtn.addEventListener("click", () => {
        closeOnboarding();
        // Focus en el primer input de dígitos
        setTimeout(() => {
          document.querySelector(".digit-box")?.focus();
        }, 300);
      });
    }
    
    // Cerrar con click en backdrop
    const backdrop = document.querySelector(".onboarding-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => {
        closeOnboarding();
      });
    }
  }
}

function closeOnboarding() {
  const tooltip = document.getElementById("onboarding-tooltip");
  if (tooltip) {
    tooltip.classList.add("hidden");
    localStorage.setItem("ghostdrop-onboarding-seen", "true");
    haptic([6]);
  }
}

// ─── Init ──────────────────────────────────────────────────

async function init() {
  document.querySelector(".logo").classList.add("logo-animate");
  setTimeout(() => document.querySelector(".logo").classList.remove("logo-animate"), 1000);

  hide(roomBadge, dropSection, textSection, listSection);
  setStatus(t('statusNoRoom'), "info");
  renderRecent();

  document.getElementById("compact-btn")?.addEventListener("click", toggleCompact);
  document.getElementById("download-all-btn")?.addEventListener("click", downloadAllAsZip);
  makeRipple(".btn-primary, .btn-secondary, .badge-btn, .dl-btn");

  // Digit input
  initDigitInput();

  // TTL Picker
  initTTLPicker();

  // Auto-join por URL (soporta ?sala= y ?room=)
  const params = new URLSearchParams(location.search);
  const salaParam = params.get("sala") || params.get("room");
  
  // Mostrar onboarding INMEDIATAMENTE si no hay auto-join
  if (!salaParam || sanitizeCode(salaParam).length !== 5) {
    initOnboarding();
  }

  // Calibrar DESPUÉS del onboarding para no bloquear la UI
  await calibrateServerTime().catch(() => {});

  // Procesar auto-join después de la calibración
  if (salaParam && sanitizeCode(salaParam).length === 5) {
    joinRoom(sanitizeCode(salaParam));
  }

  setInterval(cleanExpired, 60_000); // Limpieza local cada minuto
  setInterval(cleanExpiredGlobal, 2 * 60_000); // Limpieza global cada 2 minutos
  cleanExpiredGlobal(); // Ejecutar inmediatamente al cargar
  setInterval(calibrateServerTime, 5 * 60_000);
  loadTotalUploads();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  
  // Listener para cuando vuelves a la pestaña
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && roomId) {
      // Re-sincronizar cuando vuelves a la pestaña
      loadFiles(); // Recargar archivos del servidor
      cleanExpired({ silent: true }); // Limpiar expirados silenciosamente
    }
  });
}

init();

notifyBtn.addEventListener("click", requestNotifications);

// Haptic feedback for language switch - delegated through i18n.js
window.i18n.__haptic = () => haptic?.([8]);
