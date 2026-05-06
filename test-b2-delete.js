// ============================================================
// TEST DE BORRADO DE B2
// ============================================================
// Copia y pega este código en la consola del navegador (F12)

console.log("🧪 Iniciando test de borrado de B2...\n");

// 1. Verificar funciones
console.log("1️⃣ Verificando funciones disponibles:");
console.log("   - deleteFromB2:", typeof deleteFromB2);
console.log("   - cleanExpiredGlobal:", typeof cleanExpiredGlobal);
console.log("   - db:", typeof db);

// 2. Buscar archivos B2 expirados
console.log("\n2️⃣ Buscando archivos B2 expirados...");

const now = new Date();
console.log("   Hora actual:", now.toISOString());

db.from("drops")
  .select("*")
  .eq("storage", "b2")
  .then(async ({ data, error }) => {
    if (error) {
      console.error("❌ Error:", error);
      return;
    }
    
    console.log(`\n✅ Encontrados ${data.length} archivos B2 en total`);
    
    if (data.length === 0) {
      console.log("   No hay archivos B2 en la base de datos");
      return;
    }
    
    // Separar expirados y activos
    const expired = data.filter(f => new Date(f.expires_at) < now);
    const active = data.filter(f => new Date(f.expires_at) >= now);
    
    console.log(`\n📊 Resumen:`);
    console.log(`   - Archivos activos: ${active.length}`);
    console.log(`   - Archivos expirados: ${expired.length}`);
    
    if (expired.length > 0) {
      console.log(`\n🗑️ Archivos expirados que deberían borrarse:`);
      expired.forEach((f, i) => {
        const expiredAgo = Math.floor((now - new Date(f.expires_at)) / 1000 / 60);
        console.log(`\n   ${i + 1}. ${f.file_name}`);
        console.log(`      B2 Key: ${f.b2_key}`);
        console.log(`      Expiró hace: ${expiredAgo} minutos`);
        console.log(`      Expires at: ${f.expires_at}`);
      });
      
      console.log(`\n💡 Para borrar estos archivos manualmente:`);
      console.log(`   cleanExpiredGlobal()`);
      
      // Probar borrado de uno
      if (expired.length > 0) {
        console.log(`\n🧪 Probando borrar el primer archivo...`);
        const testFile = expired[0];
        
        try {
          console.log(`   Borrando: ${testFile.b2_key}`);
          await deleteFromB2(testFile.b2_key);
          console.log(`   ✅ Borrado exitoso de B2`);
          
          // Borrar de la BD también
          const { error: dbError } = await db.from("drops").delete().eq("id", testFile.id);
          if (dbError) {
            console.error(`   ❌ Error borrando de BD:`, dbError);
          } else {
            console.log(`   ✅ Borrado exitoso de BD`);
            console.log(`\n   🎉 Archivo completamente borrado!`);
            console.log(`   Verifica en B2 Dashboard que desapareció:`);
            console.log(`   https://secure.backblaze.com/b2_buckets.htm`);
          }
        } catch (error) {
          console.error(`   ❌ Error borrando:`, error);
        }
      }
    } else {
      console.log(`\n✅ No hay archivos expirados para borrar`);
      
      if (active.length > 0) {
        console.log(`\n📋 Archivos activos (no se borrarán aún):`);
        active.slice(0, 3).forEach((f, i) => {
          const expiresIn = Math.floor((new Date(f.expires_at) - now) / 1000 / 60);
          console.log(`\n   ${i + 1}. ${f.file_name}`);
          console.log(`      B2 Key: ${f.b2_key}`);
          console.log(`      Expira en: ${expiresIn} minutos`);
        });
      }
    }
  });

// 3. Verificar proxy
console.log("\n3️⃣ Verificando proxy B2...");
fetch('http://localhost:3001/health')
  .then(res => res.json())
  .then(data => {
    console.log("✅ Proxy funcionando:");
    console.log("  ", data);
  })
  .catch(err => {
    console.error("❌ Proxy no responde:", err.message);
  });

console.log("\n✅ Test iniciado. Espera los resultados arriba...");
