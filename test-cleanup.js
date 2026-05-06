// ============================================================
// SCRIPT DE PRUEBA - LIMPIEZA DE B2
// ============================================================
// Copia y pega este código en la consola del navegador (F12)

console.log("🧪 Iniciando prueba de limpieza...");

// 1. Verificar que las funciones existen
console.log("✓ Verificando funciones...");
console.log("  - cleanExpiredGlobal:", typeof cleanExpiredGlobal);
console.log("  - deleteFromB2:", typeof deleteFromB2);
console.log("  - db:", typeof db);

// 2. Buscar archivos expirados
console.log("\n📋 Buscando archivos expirados...");
const now = new Date().toISOString();
console.log("  Hora actual:", now);

db.from("drops")
  .select("id, file_name, storage, b2_key, expires_at, created_at")
  .lt("expires_at", now)
  .then(({ data, error }) => {
    if (error) {
      console.error("❌ Error buscando archivos:", error);
      return;
    }
    
    console.log(`\n✅ Encontrados ${data.length} archivos expirados:`);
    
    if (data.length === 0) {
      console.log("  No hay archivos expirados para borrar");
      console.log("\n💡 Tip: Sube un archivo con TTL de 5 minutos y espera a que expire");
      return;
    }
    
    // Mostrar detalles
    data.forEach((file, i) => {
      console.log(`\n  ${i + 1}. ${file.file_name}`);
      console.log(`     Storage: ${file.storage}`);
      console.log(`     B2 Key: ${file.b2_key || 'N/A'}`);
      console.log(`     Expiró: ${file.expires_at}`);
      console.log(`     Creado: ${file.created_at}`);
    });
    
    // Contar por storage
    const b2Files = data.filter(f => f.storage === 'b2');
    const supabaseFiles = data.filter(f => f.storage !== 'b2');
    
    console.log(`\n📊 Resumen:`);
    console.log(`  - Archivos en Supabase: ${supabaseFiles.length}`);
    console.log(`  - Archivos en B2: ${b2Files.length}`);
    
    if (b2Files.length > 0) {
      console.log(`\n🗑️ Archivos B2 a borrar:`);
      b2Files.forEach(f => {
        console.log(`  - ${f.b2_key}`);
      });
      
      console.log(`\n💡 Para borrar estos archivos, ejecuta:`);
      console.log(`   cleanExpiredGlobal()`);
    }
  });

// 3. Verificar proxy B2
console.log("\n🔌 Verificando proxy B2...");
fetch('http://localhost:3001/health')
  .then(res => res.json())
  .then(data => {
    console.log("✅ Proxy B2 funcionando:");
    console.log("  ", data);
  })
  .catch(err => {
    console.error("❌ Proxy B2 no responde:", err.message);
    console.log("💡 Asegúrate de que el proxy esté corriendo: npm start");
  });

console.log("\n✅ Prueba completada");
console.log("\n📝 Comandos útiles:");
console.log("  cleanExpiredGlobal()  - Ejecutar limpieza global");
console.log("  cleanExpired()        - Ejecutar limpieza local (sala actual)");
