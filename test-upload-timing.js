// ============================================================
// TEST DE TIMING DE SUBIDA
// ============================================================
// Copia y pega este código en la consola del navegador (F12)
// ANTES de subir un archivo

console.log("🧪 Test de timing instalado");

// Interceptar uploadToB2
const originalUploadToB2 = window.uploadToB2;
if (!originalUploadToB2) {
  console.error("❌ uploadToB2 no está disponible");
} else {
  window.uploadToB2 = async function(blob, fileName, onProgress) {
    console.log("⏱️ [INICIO] uploadToB2 llamado");
    console.log("   Tamaño:", (blob.size / 1024 / 1024).toFixed(2), "MB");
    
    const startTime = Date.now();
    
    // Wrapper del callback de progreso
    const wrappedProgress = (loaded, total) => {
      const pct = ((loaded / total) * 100).toFixed(1);
      console.log(`   📊 Progreso: ${pct}% (${(loaded / 1024 / 1024).toFixed(2)} / ${(total / 1024 / 1024).toFixed(2)} MB)`);
      
      if (onProgress) {
        onProgress(loaded, total);
      }
    };
    
    try {
      const result = await originalUploadToB2(blob, fileName, wrappedProgress);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️ [FIN] uploadToB2 completado en ${elapsed}s`);
      console.log("   Key:", result.key);
      return result;
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`⏱️ [ERROR] uploadToB2 falló después de ${elapsed}s:`, error);
      throw error;
    }
  };
  
  console.log("✅ Test instalado. Ahora sube un archivo >50MB");
  console.log("   Verás el timing exacto de la subida");
}

// Interceptar cuando la barra llega al 100%
const originalProgressBar = document.getElementById("progress-bar");
if (originalProgressBar) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const width = originalProgressBar.style.width;
        if (width === '100%') {
          console.log("🎯 [BARRA] Llegó al 100%");
        }
      }
    });
  });
  
  observer.observe(originalProgressBar, {
    attributes: true,
    attributeFilter: ['style']
  });
  
  console.log("✅ Observer de barra instalado");
}
