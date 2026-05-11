// ============================================================
// GHOST-DROP — Internacionalización (i18n) - Versión Simplificada
// ============================================================

const translations = {
  es: {
    // Header
    tagline: "Comparte archivos en 5 segundos. Sin registro. Sin apps. Cifrado E2E.",
    
    // Status
    statusNoRoom: "Sin sala activa",
    statusConnecting: "Conectando…",
    statusActive: "Sala {room} activa",
    
    // Room badge
    copyBtn: "Copiar",
    inviteBtn: "Invitar",
    qrBtn: "QR",
    leaveBtn: "Salir",
    
    // Room section
    roomTitle: "Entrar a una sala",
    roomDesc: "Usa un código de 5 caracteres para compartir con quien quieras, desde cualquier red.",
    joinBtn: "Entrar",
    newRoomBtn: "🎲 Sala aleatoria",
    recentLabel: "Recientes",
    
    // Drop section
    dropTitle: "Compartir archivo",
    dropLabel: "Arrastra archivos aquí",
    dropSub: "o toca para seleccionar · <strong>Máx: 250MB</strong></small>",
    
    // Text section
    textTitle: "Compartir texto / enlace",
    textPlaceholder: "Pega un texto, enlace o nota…",
    typingIndicator: "alguien está escribiendo…",
    sendBtn: "Enviar",
    
    // TTL options
    ttl1min: "1 min",
    ttl5min: "5 min",
    ttl15min: "15 min",
    
    // List section
    listTitle: "En la sala",
    downloadAllBtn: "Descargar todo",
    notifyBtn: "Notificar",
    compactBtn: "Compacto",
    
    // Empty state
    emptyGhost: "👻",
    emptyTitle: "La sala está despejada.",
    emptySub: "El radar no detecta archivos.",
    
    // TTL Picker
    ttlPickerTitle: "¿Cuánto tiempo le damos?",
    ttlPickerSub: "El archivo desaparecerá para todos al expirar",
    ttlPickerBurn: "🔥 Borrar después de 1 descarga",
    ttlPickerCancel: "Cancelar",
    
    // QR Modal
    qrTitle: "Escanea para unirte",
    qrClose: "Cerrar",
    
    // Onboarding
    onboardingTitle: "¡Bienvenido a Ghost Drop!",
    onboardingDesc: "Compartir archivos nunca fue tan fácil:",
    onboardingStep1: "Crea una sala con 5 caracteres",
    onboardingStep2: "Arrastra tus archivos",
    onboardingStep3: "Comparte el código",
    onboardingCta: "Entendido, empecemos 🚀",
    
    // Toast messages
    toastJoinFirst: "Únete a una sala primero",
    toastEncrypting: "Cifrando {file}…",
    toastUploading: "Subiendo {file}…",
    toastErrorEncrypt: "Error cifrando: {error}",
    toastError: "Error: {error}",
    toastFileTooLarge: "❌ {file} es demasiado grande. Máximo: 250MB (actual: {size})",
    toastB2Disabled: "Servicio de archivos grandes no disponible. Intenta de nuevo. 🙏",
    toastLinkCopied: "🔗 Enlace copiado. Compártelo por WhatsApp, email, etc.",
    toastCopied: "¡Copiado!",
    toastSomeoneJoined: "Alguien entró a la sala",
    toastNewFile: "Nuevo archivo: {name}",
    toastNewText: "Nuevo texto: {name}",
    toastNotificationsEnabled: "Notificaciones activadas",
    toastNotificationsDenied: "Permiso denegado",
    toastNotificationsUnavailable: "No disponible en este navegador",
    toastDownloading: "Descargando {n}/{total}…",
    toastGeneratingZip: "Generando ZIP…",
    toastDownloaded: "{n} archivo(s) descargados{burn} ✓",
    toastDeleting: "Borrando {n} archivo(s) con burn after reading…",
    toastNoFiles: "No se pudo descargar ningún archivo",
    toastDecrypting: "Descifrando…",
    toastErrorDecrypt: "Error descifrando: {error}",
    toastBurning: "Eliminando archivo (burn after reading)…",
    toastDownloadedBurned: "Descargado y eliminado ✓",
    toastDownloadComplete: "Descarga completada: {file} ✓",
    toastErrorDownload: "Error descargando: {error}",
    toastDownloadQueued: "Descarga en cola ({n} esperando)",
    toastCodeRequired: "Código de 5 caracteres",
    toastLinkCopiedClipboard: "Link copiado al portapapeles",
    dlProgress: "Descargando: {loaded} / {total}",
    toastDownloadingSimple: "Descargando…",
    dlProgressSimple: "Descargando: {loaded}…",
    
    // Progress
    progressSaving: "Guardando en base de datos...",
    progressFinalizing: "Finalizando...",
    
    // File actions
    downloadBtn: "Descargar",
    copyTextBtn: "Copiar",
    previewBtn: "👁",
    
    // Timer
    timerExpired: "Expiró",
    
    // Burn badge
    burnBadge: "Se borra después de 1 descarga",
    
    // Footer
    footerPrivacy: "Privacidad",
    footerTerms: "Términos",
    footerOpenSource: "Open Source",
    footerCopyright: "© 2026 Jorge Ugas. Todos los derechos reservados.",
    footerStats: "✦ {n} archivo{s} compartido{s} hasta ahora",
    
    // Notifications
    notificationTitle: "Ghost Drop",
    notificationBody: "Nuevo {type} en sala {room}",
    notificationFile: "archivo",
    notificationText: "texto",
    
    // Errors
    errorDecrypt: "No se pudo descifrar este texto",
    errorConnection: "Error de conexión. Verifica tu internet",
    errorTooLarge: "Archivo demasiado grande para subir",
    errorTimeout: "La subida tardó demasiado. Intenta con un archivo más pequeño",
    errorCors: "Error de configuración. Contacta al administrador",
    errorNetwork: "Error de red",
    errorUpload: "Error subiendo archivo",
    errorAuth: "Error de autenticación con el servidor de archivos",
    errorJSZip: "JSZip no está cargado",
    toastNoFilesToDownload: "No hay archivos para descargar",
    toastUploaded: "{n} archivo(s) compartido(s) ✓",
    toastTextShared: "Texto compartido ✓",
    toastInvalidChar: '"{char}" no válido. Usa: 2-9, A-Z (sin 0,1,B,I,O,Q,V)',
    
    // Time units
    timeSeconds: "{n}s",
    timeMinutes: "{n}m",
    timeHours: "{n}h",
    timeRemaining: "{n} restante",
    
    // Misc
    room: "Sala",
    people: "personas",
    person: "persona",
  },
  
  en: {
    // Header
    tagline: "Share files in 5 seconds. No signup. No apps. E2E encrypted.",
    
    // Status
    statusNoRoom: "No active room",
    statusConnecting: "Connecting…",
    statusActive: "Room {room} active",
    
    // Room badge
    copyBtn: "Copy",
    inviteBtn: "Invite",
    qrBtn: "QR",
    leaveBtn: "Leave",
    
    // Room section
    roomTitle: "Join a room",
    roomDesc: "Use a 5-character code to share with anyone, from any network.",
    joinBtn: "Join",
    newRoomBtn: "🎲 Random room",
    recentLabel: "Recent",
    
    // Drop section
    dropTitle: "Share file",
    dropLabel: "Drag files here",
    dropSub: "or tap to select · <strong>Max: 250MB</strong></small>",
    
    // Text section
    textTitle: "Share text / link",
    textPlaceholder: "Paste text, link or note…",
    typingIndicator: "someone is typing…",
    sendBtn: "Send",
    
    // TTL options
    ttl1min: "1 min",
    ttl5min: "5 min",
    ttl15min: "15 min",
    
    // List section
    listTitle: "In room",
    downloadAllBtn: "Download all",
    notifyBtn: "Notify",
    compactBtn: "Compact",
    
    // Empty state
    emptyGhost: "👻",
    emptyTitle: "Room is clear.",
    emptySub: "Radar detects no files.",
    
    // TTL Picker
    ttlPickerTitle: "How long should it last?",
    ttlPickerSub: "File will disappear for everyone when expired",
    ttlPickerBurn: "🔥 Delete after 1 download",
    ttlPickerCancel: "Cancel",
    
    // QR Modal
    qrTitle: "Scan to join",
    qrClose: "Close",
    
    // Onboarding
    onboardingTitle: "Welcome to Ghost Drop!",
    onboardingDesc: "Sharing files has never been easier:",
    onboardingStep1: "Create a room with 5 characters",
    onboardingStep2: "Drag your files",
    onboardingStep3: "Share the code",
    onboardingCta: "Got it, let's start 🚀",
    
    // Toast messages
    toastJoinFirst: "Join a room first",
    toastEncrypting: "Encrypting {file}…",
    toastUploading: "Uploading {file}…",
    toastErrorEncrypt: "Encryption error: {error}",
    toastError: "Error: {error}",
    toastFileTooLarge: "❌ {file} is too large. Max: 250MB (actual: {size})",
    toastB2Disabled: "Large file service unavailable. Try again. 🙏",
    toastLinkCopied: "🔗 Link copied. Share it via WhatsApp, email, etc.",
    toastCopied: "Copied!",
    toastSomeoneJoined: "Someone joined the room",
    toastNewFile: "New file: {name}",
    toastNewText: "New text: {name}",
    toastNotificationsEnabled: "Notifications enabled",
    toastNotificationsDenied: "Permission denied",
    toastNotificationsUnavailable: "Not available in this browser",
    toastDownloading: "Downloading {n}/{total}…",
    toastGeneratingZip: "Generating ZIP…",
    toastDownloaded: "{n} file(s) downloaded{burn} ✓",
    toastDeleting: "Deleting {n} file(s) with burn after reading…",
    toastNoFiles: "Could not download any files",
    toastDecrypting: "Decrypting…",
    toastErrorDecrypt: "Decrypt error: {error}",
    toastBurning: "Deleting file (burn after reading)…",
    toastDownloadedBurned: "Downloaded and deleted ✓",
    toastDownloadComplete: "Download complete: {file} ✓",
    toastErrorDownload: "Download error: {error}",
    toastDownloadQueued: "Download queued ({n} waiting)",
    toastCodeRequired: "5-character code required",
    toastLinkCopiedClipboard: "Link copied to clipboard",
    dlProgress: "Downloading: {loaded} / {total}",
    toastDownloadingSimple: "Downloading…",
    dlProgressSimple: "Downloading: {loaded}…",
    
    // Progress
    progressSaving: "Saving to database...",
    progressFinalizing: "Finalizing...",
    
    // File actions
    downloadBtn: "Download",
    copyTextBtn: "Copy",
    previewBtn: "👁",
    
    // Timer
    timerExpired: "Expired",
    
    // Burn badge
    burnBadge: "Deletes after 1 download",
    
    // Footer
    footerPrivacy: "Privacy",
    footerTerms: "Terms",
    footerOpenSource: "Open Source",
    footerCopyright: "© 2026 Jorge Ugas. All rights reserved.",
    footerStats: "✦ {n} file{s} shared so far",
    
    // Notifications
    notificationTitle: "Ghost Drop",
    notificationBody: "New {type} in room {room}",
    notificationFile: "file",
    notificationText: "text",
    
    // Errors
    errorDecrypt: "Could not decrypt this text",
    errorConnection: "Connection error. Check your internet",
    errorTooLarge: "File too large to upload",
    errorTimeout: "Upload took too long. Try a smaller file",
    errorCors: "Configuration error. Contact administrator",
    errorUpload: "Error uploading file",
    errorAuth: "Authentication error with file server",
    errorJSZip: "JSZip is not loaded",
    toastNoFilesToDownload: "No files to download",
    toastUploaded: "{n} file(s) shared ✓",
    toastTextShared: "Text shared ✓",
    toastInvalidChar: '"{char}" invalid. Use: 2-9, A-Z (no 0,1,B,I,O,Q,V)',
    errorNetwork: "Network error",
    
    // Time units
    timeSeconds: "{n}s",
    timeMinutes: "{n}m",
    timeHours: "{n}h",
    timeRemaining: "{n} remaining",
    
    // Misc
    room: "Room",
    people: "people",
    person: "person",
  }
};

// ─── Sistema i18n Simplificado ─────────────────────────────

let currentLang = 'en';

function detectLanguage() {
  // 1. Verificar localStorage
  const saved = localStorage.getItem('ghostdrop-lang');
  if (saved && translations[saved]) {
    return saved;
  }
  
  // 2. Detectar idioma del navegador
  const browserLang = navigator.language || navigator.userLanguage;
  return browserLang.startsWith('es') ? 'es' : 'en';
}

function t(key, params = {}) {
  let text = translations[currentLang][key] || translations['en'][key] || key;
  
  // Reemplazar parámetros {param}
  Object.keys(params).forEach(param => {
    text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });
  
  return text;
}

function applyTranslations(lang) {
  currentLang = lang;
  localStorage.setItem('ghostdrop-lang', lang);
  document.documentElement.lang = lang;
  
  // Actualizar el objeto global
  window.i18n.currentLang = lang;
  
  // Actualizar todos los elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = text;
    } else if (el.dataset.i18nHtml) {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
  });
  
  // Actualizar botón de idioma
  updateLanguageButton();
  
  console.log('🌐 Idioma aplicado:', lang);
}

function getFlagsHTML(lang) {
  const esp = '<svg viewBox="0 0 24 16" width="15" height="10" style="flex-shrink:0;border-radius:1.5px"><rect width="24" height="16" fill="#c60b1e"/><rect y="4" width="24" height="8" fill="#ffc400"/></svg>';
  const mex = '<svg viewBox="0 0 24 16" width="15" height="10" style="flex-shrink:0;border-radius:1.5px"><rect width="8" height="16" fill="#006847"/><rect x="8" width="8" height="16" fill="#fff"/><rect x="16" width="8" height="16" fill="#ce1126"/></svg>';
  const usa = '<svg viewBox="0 0 24 16" width="15" height="10" style="flex-shrink:0;border-radius:1.5px"><rect width="24" height="16" fill="#b22234"/><rect y="2" width="24" height="2" fill="#fff"/><rect y="6" width="24" height="2" fill="#fff"/><rect y="10" width="24" height="2" fill="#fff"/><rect y="14" width="24" height="2" fill="#fff"/><rect width="9.5" height="8" fill="#3c3b6e"/></svg>';
  const eng = '<svg viewBox="0 0 24 16" width="15" height="10" style="flex-shrink:0;border-radius:1.5px"><rect width="24" height="16" fill="#fff"/><rect x="10.5" width="3" height="16" fill="#ce1124"/><rect y="6.5" width="24" height="3" fill="#ce1124"/></svg>';
  const sep = '<span style="opacity:0.25;font-size:0.5rem;line-height:1">/</span>';
  return lang === 'es' ? esp + sep + mex : usa + sep + eng;
}

function updateLanguageButton() {
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    const langCode = langBtn.querySelector('.lang-code');
    const langFlags = langBtn.querySelector('.lang-flags');
    
    if (langCode) {
      langCode.textContent = currentLang === 'es' ? 'ES' : 'EN';
    }
    
    if (langFlags) {
      langFlags.innerHTML = getFlagsHTML(currentLang);
    }
    
    // Update active state in dropdown options
    langBtn.querySelectorAll('.lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === currentLang);
    });
    
    langBtn.title = currentLang === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish';
  }
}

function toggleLanguage() {
  const newLang = currentLang === 'es' ? 'en' : 'es';
  console.log('🌐 Cambiando idioma:', currentLang, '→', newLang);
  applyTranslations(newLang);
}

// ─── Inicialización ────────────────────────────────────────

function initI18n() {
  // Detectar y aplicar idioma inicial
  const lang = detectLanguage();
  applyTranslations(lang);
  
  // Configurar botón de idioma
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    // Verificar si ya está configurado
    if (langBtn.dataset.i18nConfigured === 'true') {
      console.log('🌐 Botón de idioma ya configurado, saltando...');
      return;
    }
    
    // Remover eventos anteriores
    langBtn.replaceWith(langBtn.cloneNode(true));
    const newLangBtn = document.getElementById('lang-btn');
    
    // Marcar como configurado
    newLangBtn.dataset.i18nConfigured = 'true';
    
    // Agregar evento único
    newLangBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('🌐 Click en botón de idioma detectado');
      toggleLanguage();
    });
    
    console.log('🌐 Botón de idioma configurado correctamente');
  } else {
    console.warn('🌐 Botón de idioma no encontrado');
  }
}

// ─── Objeto global compatible ──────────────────────────────

window.i18n = {
  get currentLang() { return currentLang; },
  set currentLang(lang) { currentLang = lang; },
  t: t,
  toggleLanguage: toggleLanguage,
  applyTranslations: applyTranslations,
  // Función de debug
  debug: function() {
    const langBtn = document.getElementById('lang-btn');
    console.log('🌐 Debug i18n:');
    console.log('  - Idioma actual:', currentLang);
    console.log('  - Botón encontrado:', !!langBtn);
    console.log('  - Botón configurado:', langBtn?.dataset.i18nConfigured === 'true');
    console.log('  - Texto del botón:', langBtn?.textContent);
    return {
      currentLang,
      buttonFound: !!langBtn,
      buttonConfigured: langBtn?.dataset.i18nConfigured === 'true',
      buttonText: langBtn?.textContent
    };
  },
  // Función para forzar reinicialización
  forceInit: function() {
    console.log('🌐 Forzando reinicialización...');
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
      langBtn.dataset.i18nConfigured = 'false';
      langBtn.removeAttribute('data-i18n-configured');
    }
    return forceInitUntilWorks();
  }
};

// ─── Auto-inicialización AGRESIVA ──────────────────────────

// Función que se ejecuta múltiples veces hasta que funcione
function forceInitUntilWorks() {
  const langBtn = document.getElementById('lang-btn');
  
  if (!langBtn) {
    console.log('🌐 Botón no encontrado, reintentando...');
    return false;
  }
  
  if (langBtn.dataset.i18nConfigured === 'true') {
    console.log('🌐 Botón ya configurado');
    return true;
  }
  
  try {
    // Detectar y aplicar idioma
    const lang = detectLanguage();
    applyTranslations(lang);
    
    // Configurar botón de forma agresiva
    langBtn.replaceWith(langBtn.cloneNode(true));
    const newLangBtn = document.getElementById('lang-btn');
    
    if (!newLangBtn) {
      console.warn('🌐 Error clonando botón');
      return false;
    }
    
    // Marcar como configurado ANTES de agregar evento
    newLangBtn.dataset.i18nConfigured = 'true';
    
    // Agregar evento para dropdown
    const clickHandler = function(e) {
      // Dropdown option click: switch language (let event bubble for subpages)
      const option = e.target.closest('.lang-option');
      if (option) {
        e.preventDefault();
        const lang = option.dataset.lang;
        if (lang) {
          applyTranslations(lang);
        }
        newLangBtn.classList.remove('open');
        if (typeof window.i18n?.__haptic === 'function') window.i18n.__haptic();
        return;
      }
      
      // Trigger click: toggle dropdown (mobile/touch support)
      e.stopPropagation();
      if (e.target.closest('.lang-trigger, .lang-code, .lang-chevron, .lang-globe')) {
        e.preventDefault();
        newLangBtn.classList.toggle('open');
      }
    };
    
    // Único método: addEventListener
    newLangBtn.addEventListener('click', clickHandler);
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function closeOutside(e) {
      document.querySelectorAll('.lang-switcher.open').forEach(el => {
        if (!el.contains(e.target)) {
          el.classList.remove('open');
        }
      });
    });
    
    // Método 3: Verificar que el evento se agregó
    setTimeout(() => {
      if (newLangBtn.onclick || newLangBtn.addEventListener) {
        console.log('✅ Botón de idioma configurado exitosamente');
      } else {
        console.warn('⚠️ Problema configurando evento');
      }
    }, 100);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error configurando botón:', error);
    return false;
  }
}

// Ejecutar inmediatamente
forceInitUntilWorks();

// Ejecutar cuando DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', forceInitUntilWorks);
} else {
  forceInitUntilWorks();
}

// Reintentos agresivos cada segundo hasta que funcione
let retryCount = 0;
const maxRetries = 10;

const retryInterval = setInterval(() => {
  retryCount++;
  
  if (retryCount > maxRetries) {
    console.warn('🌐 Máximo de reintentos alcanzado');
    clearInterval(retryInterval);
    return;
  }
  
  const success = forceInitUntilWorks();
  if (success) {
    console.log(`✅ Botón configurado exitosamente en intento ${retryCount}`);
    clearInterval(retryInterval);
  } else {
    console.log(`🔄 Reintento ${retryCount}/${maxRetries}...`);
  }
}, 1000);

// También ejecutar en eventos de ventana
window.addEventListener('load', forceInitUntilWorks);
window.addEventListener('focus', forceInitUntilWorks);

// Observador de mutaciones para detectar cuando se agrega el botón
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && (node.id === 'lang-btn' || node.querySelector('#lang-btn'))) {
            console.log('🌐 Botón detectado por MutationObserver');
            setTimeout(forceInitUntilWorks, 100);
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Sistema de auto-reparación: verificar cada 5 segundos si el botón funciona
setInterval(() => {
  const langBtn = document.getElementById('lang-btn');
  if (langBtn && langBtn.dataset.i18nConfigured !== 'true') {
    console.log('🔧 Auto-reparación: botón no configurado, arreglando...');
    forceInitUntilWorks();
  }
}, 5000);