/**
 * INTEGRACIÓN DE TELEGRAM EN APP.JS
 * 
 * Este archivo contiene las funciones modificadas para soportar Telegram.
 * Copia y pega estas funciones en app.js reemplazando las originales.
 */

// ============================================================
// 1. IMPORTAR MÓDULO DE TELEGRAM (agregar al inicio de app.js)
// ============================================================

// Agregar después de las primeras líneas, antes de las variables globales:
import { uploadToTelegram, downloadFromTelegram, deleteFromTelegram } from './storage-telegram.js';

// ============================================================
// 2. FUNCIÓN PARA SELECCIONAR STORAGE
// ============================================================

// Agregar esta función nueva antes de uploadFiles():
function selectStorage(fileSize) {
  const SUPABASE_MAX = 50 * 1024 * 1024; // 50 MB
  const TELEGRAM_MAX = 2000 * 1024 * 1024; // 2 GB
  
  if (fileSize < SUPABASE_MAX) {
    return "supabase";
  }
  if (fileSize < TELEGRAM_MAX) {
    return "telegram";
  }
  throw new Error(`Archivo demasiado grande. Máximo: 2GB`);
}

// ============================================================
// 3. FUNCIÓN uploadFiles() MODIFICADA
// ============================================================

// REEMPLAZAR la función uploadFiles() completa con esta versión:

async function uploadFiles(files) {
  if (!roomId) { showToast("Únete a una sala primero", "error"); return; }
  let uploaded = 0;

  for (const file of Array.from(files)) {
    if (file.size === 0) continue;

    // Determinar qué storage usar
    let storage;
    try {
      storage = selectStorage(file.size);
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
    
    const storageLabel = storage === "telegram" ? " (Telegram)" : "";
    showToast(`Cifrando ${file.name.slice(0, 20)}…${storageLabel}`, "info");
    showUploadPreview(files);
    dropzone.classList.add("uploading");

    // ── Cifrar archivo ────────────────────────────────────
    let encryptedFile;
    try {
      const { blob } = await encryptFile(file, roomId);
      encryptedFile = blob;
      showToast(`Subiendo ${file.name.slice(0, 20)}…${storageLabel}`, "info");
    } catch (err) {
      progressWrap.style.display = "none";
      setProgressLabel(0, 0);
      dropzone.classList.remove("uploading");
      showToast(`Error cifrando: ${err.message}`, "error");
      continue;
    }

    let path, telegramMessageId;
    let upErr = null;

    // ── SUBIR A SUPABASE O TELEGRAM ───────────────────────
    if (storage === "supabase") {
      // Subir a Supabase (código original)
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
      // Subir a Telegram
      try {
        progressBar.classList.add("progress-pulse");
        progressBar.style.width = "50%";
        
        const result = await uploadToTelegram(encryptedFile, file.name);
        path = result.fileId; // Guardar fileId como path
        telegramMessageId = result.messageId;
        
        progressBar.style.width = "90%";
        progressBar.classList.remove("progress-pulse");
      } catch (e) {
        upErr = e;
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
    progressBar.classList.add("progress-pulse");
    progressBar.style.width = "97%";
    setProgressLabel(0.97, file.size);
    document.getElementById("progress-label").textContent = "Procesando en servidor…";

    const expiresAt = new Date(serverNow() + TTL_SECONDS * 1000).toISOString();
    const insertPayload = {
      room_id: roomId,
      file_name: file.name,
      file_size: file.size,
      storage_path: path,
      storage: storage, // "supabase" o "telegram"
      expires_at: expiresAt,
      content_type: file.type || getMimeFromName(file.name),
      burn_after_reading: BURN_AFTER_READING,
    };

    // Agregar telegram_message_id si es Telegram
    if (storage === "telegram" && telegramMessageId) {
      insertPayload.telegram_message_id = telegramMessageId;
    }

    const { error: dbErr, data: insertData } = await db
      .from("drops")
      .insert(insertPayload)
      .select("id")
      .single();

    if (dbErr) {
      // Limpiar archivo subido
      if (storage === "supabase") {
        await db.storage.from("ghost-drop").remove([path]);
      } else if (telegramMessageId) {
        await deleteFromTelegram(telegramMessageId);
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
        id: insertData.id,
        room_id: roomId,
        file_name: file.name,
        file_size: file.size,
        storage_path: path,
        storage: storage,
        telegram_message_id: telegramMessageId,
        expires_at: expiresAt,
        content_type: file.type || getMimeFromName(file.name),
        burn_after_reading: BURN_AFTER_READING,
      });
    }
    incrementTotalUploads();

    // ── 100% y cierre ─────────────────────────────────────
    progressBar.classList.remove("progress-pulse");
    progressBar.style.width = "100%";
    setProgressLabel(1, file.size);
    uploaded++;

    setTimeout(() => {
      progressWrap.style.display = "none";
      progressBar.style.width = "0%";
      setProgressLabel(0, 0);
      dropzone.classList.remove("uploading");
      clearUploadPreview();
    }, 800);
  }

  if (uploaded > 0) {
    showToast(`${uploaded} archivo${uploaded > 1 ? "s" : ""} compartido${uploaded > 1 ? "s" : ""} ✓`, "success");
  }
  fileInput.value = "";
}

// ============================================================
// 4. FUNCIÓN downloadAndDestroy() MODIFICADA
// ============================================================

// REEMPLAZAR la función downloadAndDestroy() completa con esta versión:

async function downloadAndDestroy(storagePath, dropId, fileName, contentType = "application/octet-stream", burnAfterReading = false, storage = "supabase", telegramMessageId = null) {
  showToast("Descargando…", "info");

  try {
    let encryptedBlob;

    // Descargar desde Supabase o Telegram
    if (storage === "telegram") {
      encryptedBlob = await downloadFromTelegram(storagePath); // storagePath es el fileId
    } else {
      const { data, error } = await db.storage
        .from("ghost-drop")
        .download(storagePath);

      if (error || !data) {
        showToast(`Error: ${error?.message ?? "Sin datos"}`, "error");
        return;
      }
      encryptedBlob = data;
    }

    // Descifrar el archivo
    showToast("Descifrando…", "info");
    let decryptedBlob;
    try {
      decryptedBlob = await decryptFile(encryptedBlob, roomId, contentType);
    } catch (err) {
      showToast(`Error descifrando: ${err.message}`, "error");
      return;
    }

    // Crear URL y descargar
    const url = URL.createObjectURL(decryptedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    haptic([10, 50, 10]);
    recordDownload(fileName, roomId);
    
    // Si es burn after reading, borrar inmediatamente
    if (burnAfterReading) {
      burnedDropIds.add(dropId);
      
      // Borrar de BD
      const { error: delErr } = await db.from("drops").delete().eq("id", dropId);
      
      // Borrar de storage
      if (storage === "telegram" && telegramMessageId) {
        await deleteFromTelegram(telegramMessageId);
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
      showToast("Descargado y borrado ✓", "success");
    } else {
      showToast("Descarga completada ✓", "success");
    }

  } catch (e) {
    showToast(`Error: ${e.message}`, "error");
  }
}

// ============================================================
// 5. ACTUALIZAR attachDropEvents()
// ============================================================

// Buscar la función attachDropEvents() y actualizar la parte donde se llama downloadAndDestroy:

// ANTES:
// downloadAndDestroy(drop.storage_path, drop.id, drop.file_name, drop.content_type, drop.burn_after_reading);

// DESPUÉS:
// downloadAndDestroy(drop.storage_path, drop.id, drop.file_name, drop.content_type, drop.burn_after_reading, drop.storage, drop.telegram_message_id);

// ============================================================
// 6. ACTUALIZAR cleanExpired()
// ============================================================

// Buscar la función cleanExpired() y agregar soporte para borrar de Telegram:

// Dentro del loop que borra archivos, después de borrar de Supabase, agregar:

// if (drop.storage === "telegram" && drop.telegram_message_id) {
//   await deleteFromTelegram(drop.telegram_message_id);
// }

// ============================================================
// 7. ACTUALIZAR EL MENSAJE DE LÍMITE EN index.html
// ============================================================

// En index.html, buscar "máx. 50 MB por archivo" y cambiar a:
// "máx. 2 GB por archivo"

console.log('✅ Integración de Telegram lista. Revisa las instrucciones en app-telegram-integration.js');
