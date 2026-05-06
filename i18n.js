// ============================================================
// GHOST-DROP — Internacionalización (i18n)
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
    roomDesc: "Usa un código de 6 dígitos para compartir con quien quieras, desde cualquier red.",
    joinBtn: "Entrar",
    newRoomBtn: "🎲 Sala aleatoria",
    recentLabel: "Recientes",
    
    // Drop section
    dropTitle: "Compartir archivo",
    dropLabel: "Arrastra archivos aquí",
    dropSub: "o toca para seleccionar · <strong>Máx: 500MB</strong>",
    
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
    onboardingStep1: "Crea una sala con 6 dígitos",
    onboardingStep2: "Arrastra tus archivos",
    onboardingStep3: "Comparte el código",
    onboardingCta: "Entendido, empecemos 🚀",
    
    // Toast messages
    toastJoinFirst: "Únete a una sala primero",
    toastEncrypting: "Cifrando {file}…",
    toastUploading: "Subiendo {file}…",
    toastErrorEncrypt: "Error cifrando: {error}",
    toastError: "Error: {error}",
    toastFileTooLarge: "❌ {file} es demasiado grande. Máximo: 500MB",
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
    toastCodeRequired: "Código de 6 dígitos",
    toastLinkCopiedClipboard: "Link copiado al portapapeles",
    
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
    footerCopyright: "© 2026 Ugax. Todos los derechos reservados.",
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
    roomDesc: "Use a 6-digit code to share with anyone, from any network.",
    joinBtn: "Join",
    newRoomBtn: "🎲 Random room",
    recentLabel: "Recent",
    
    // Drop section
    dropTitle: "Share file",
    dropLabel: "Drag files here",
    dropSub: "or tap to select · <strong>Max: 500MB</strong>",
    
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
    onboardingStep1: "Create a room with 6 digits",
    onboardingStep2: "Drag your files",
    onboardingStep3: "Share the code",
    onboardingCta: "Got it, let's start 🚀",
    
    // Toast messages
    toastJoinFirst: "Join a room first",
    toastEncrypting: "Encrypting {file}…",
    toastUploading: "Uploading {file}…",
    toastErrorEncrypt: "Encryption error: {error}",
    toastError: "Error: {error}",
    toastFileTooLarge: "❌ {file} is too large. Max: 500MB",
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
    toastCodeRequired: "6-digit code required",
    toastLinkCopiedClipboard: "Link copied to clipboard",
    
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
    footerCopyright: "© 2026 Ugax. All rights reserved.",
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

// ─── i18n Manager ──────────────────────────────────────────

class I18n {
  constructor() {
    this.currentLang = this.detectLanguage();
    this.loadLanguage(this.currentLang);
  }
  
  detectLanguage() {
    // 1. Verificar localStorage (preferencia guardada)
    const saved = localStorage.getItem('ghostdrop-lang');
    if (saved && translations[saved]) {
      return saved;
    }
    
    // 2. Detectar idioma del navegador
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // 'es-ES' → 'es'
    
    // 3. Si el idioma está soportado, usarlo; sino, inglés por defecto
    return translations[langCode] ? langCode : 'en';
  }
  
  loadLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('ghostdrop-lang', lang);
    document.documentElement.lang = lang;
    this.updateUI();
  }
  
  t(key, params = {}) {
    let text = translations[this.currentLang][key] || translations['en'][key] || key;
    
    // Reemplazar parámetros {param}
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });
    
    return text;
  }
  
  updateUI() {
    // Actualizar todos los elementos con data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const text = this.t(key);
      
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else if (el.dataset.i18nHtml) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    });
    
    // Actualizar botón de idioma
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
      langBtn.textContent = this.currentLang === 'es' ? 'EN' : 'ES';
      langBtn.title = this.currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español';
    }
  }
  
  toggleLanguage() {
    const newLang = this.currentLang === 'es' ? 'en' : 'es';
    this.loadLanguage(newLang);
  }
}

// Instancia global
window.i18n = new I18n();
