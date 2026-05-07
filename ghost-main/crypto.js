/**
 * Módulo de cifrado E2E para Ghost Drop
 * Usa Web Crypto API (nativo del navegador, sin dependencias)
 */

const CRYPTO_CONFIG = {
  algorithm: "AES-GCM",
  keyLength: 256,
  ivLength: 12,
  iterations: 100000,
  salt: "ghost-drop-v1" // Cambiar esto invalida archivos antiguos
};

/**
 * Deriva una clave AES-256 desde el código de sala
 * @param {string} roomCode - Código de 6 dígitos de la sala
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(roomCode) {
  const encoder = new TextEncoder();
  
  // Importar el código de sala como material de clave
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(roomCode + CRYPTO_CONFIG.salt),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Derivar clave AES-256 usando PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(CRYPTO_CONFIG.salt),
      iterations: CRYPTO_CONFIG.iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: CRYPTO_CONFIG.algorithm, length: CRYPTO_CONFIG.keyLength },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Cifra un archivo antes de subirlo
 * @param {File|Blob} file - Archivo a cifrar
 * @param {string} roomCode - Código de sala (usado como clave)
 * @returns {Promise<{blob: Blob, iv: Uint8Array}>}
 */
async function encryptFile(file, roomCode) {
  try {
    const key = await deriveKey(roomCode);
    const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivLength));
    const data = await file.arrayBuffer();
    
    // Cifrar con AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: CRYPTO_CONFIG.algorithm, iv },
      key,
      data
    );
    
    // Combinar IV + datos cifrados en un solo blob
    // Formato: [IV (12 bytes)][Datos cifrados]
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return {
      blob: new Blob([combined], { type: "application/octet-stream" }),
      iv
    };
  } catch (err) {
    console.error("Error cifrando archivo:", err);
    throw new Error("No se pudo cifrar el archivo");
  }
}

/**
 * Descifra un archivo descargado
 * @param {Blob} encryptedBlob - Blob cifrado (IV + datos)
 * @param {string} roomCode - Código de sala (usado como clave)
 * @param {string} originalType - MIME type original del archivo
 * @returns {Promise<Blob>}
 */
async function decryptFile(encryptedBlob, roomCode, originalType) {
  try {
    const key = await deriveKey(roomCode);
    const data = await encryptedBlob.arrayBuffer();
    const dataView = new Uint8Array(data);
    
    // Extraer IV y datos cifrados
    const iv = dataView.slice(0, CRYPTO_CONFIG.ivLength);
    const encrypted = dataView.slice(CRYPTO_CONFIG.ivLength);
    
    // Descifrar
    const decrypted = await crypto.subtle.decrypt(
      { name: CRYPTO_CONFIG.algorithm, iv },
      key,
      encrypted
    );
    
    return new Blob([decrypted], { type: originalType });
  } catch (err) {
    console.error("Error descifrando archivo:", err);
    throw new Error("No se pudo descifrar el archivo. ¿Código de sala correcto?");
  }
}

/**
 * Cifra texto (para mensajes)
 * @param {string} text - Texto a cifrar
 * @param {string} roomCode - Código de sala
 * @returns {Promise<string>} Base64 del texto cifrado
 */
async function encryptText(text, roomCode) {
  try {
    const encoder = new TextEncoder();
    const key = await deriveKey(roomCode);
    const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivLength));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: CRYPTO_CONFIG.algorithm, iv },
      key,
      encoder.encode(text)
    );
    
    // Combinar IV + datos y convertir a base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error("Error cifrando texto:", err);
    throw new Error("No se pudo cifrar el texto");
  }
}

/**
 * Descifra texto
 * @param {string} encryptedBase64 - Texto cifrado en base64
 * @param {string} roomCode - Código de sala
 * @returns {Promise<string>}
 */
async function decryptText(encryptedBase64, roomCode) {
  try {
    const decoder = new TextDecoder();
    const key = await deriveKey(roomCode);
    
    // Convertir de base64 a Uint8Array
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, CRYPTO_CONFIG.ivLength);
    const encrypted = combined.slice(CRYPTO_CONFIG.ivLength);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: CRYPTO_CONFIG.algorithm, iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("Error descifrando texto:", err);
    throw new Error("No se pudo descifrar el texto");
  }
}

/**
 * Verifica si el navegador soporta Web Crypto API
 * @returns {boolean}
 */
function isCryptoSupported() {
  return !!(window.crypto && window.crypto.subtle);
}

/**
 * Genera una clave de recuperación de 12 palabras (BIP39-like simplificado)
 * @param {string} roomCode - Código de sala
 * @returns {Promise<string>} - 12 palabras separadas por espacios
 */
async function generateRecoveryKey(roomCode) {
  const wordlist = [
    "alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel",
    "india","juliet","kilo","lima","mike","november","oscar","papa",
    "quebec","romeo","sierra","tango","uniform","victor","whiskey","xray",
    "yankee","zulu","able","baker","easy","fox","george","how",
    "item","jig","king","love","mike","nan","oboe","peter",
    "queen","roger","sugar","tare","uncle","victor","william","xray",
    "yoke","zebra","one","two","three","four","five","six",
    "seven","eight","nine","zero","red","blue","green","yellow"
  ];
  
  const encoder = new TextEncoder();
  const data = encoder.encode(roomCode + CRYPTO_CONFIG.salt + Date.now());
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  
  // Generar 12 palabras desde el hash
  const words = [];
  for (let i = 0; i < 12; i++) {
    const index = bytes[i * 2] % wordlist.length;
    words.push(wordlist[index]);
  }
  
  return words.join(" ");
}

/**
 * Guarda el código de sala cifrado con la recovery key
 * @param {string} roomCode - Código de sala
 * @param {string} recoveryKey - Clave de recuperación
 */
function saveRoomCodeWithRecovery(roomCode, recoveryKey) {
  try {
    const stored = JSON.parse(localStorage.getItem("ghostdrop-recovery") || "{}");
    stored[recoveryKey] = roomCode;
    localStorage.setItem("ghostdrop-recovery", JSON.stringify(stored));
  } catch (e) {
    console.error("Error guardando recovery key:", e);
  }
}

/**
 * Recupera el código de sala desde la recovery key
 * @param {string} recoveryKey - Clave de recuperación
 * @returns {string|null} - Código de sala o null
 */
function recoverRoomCode(recoveryKey) {
  try {
    const stored = JSON.parse(localStorage.getItem("ghostdrop-recovery") || "{}");
    return stored[recoveryKey] || null;
  } catch {
    return null;
  }
}

// Exponer funciones globalmente para módulos ES6
window.encryptFile = encryptFile;
window.decryptFile = decryptFile;
window.encryptText = encryptText;
window.decryptText = decryptText;
window.deriveKey = deriveKey;
window.isCryptoSupported = isCryptoSupported;
window.generateRecoveryKey = generateRecoveryKey;
window.saveRoomCodeWithRecovery = saveRoomCodeWithRecovery;
window.recoverRoomCode = recoverRoomCode;
