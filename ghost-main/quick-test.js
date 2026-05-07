/**
 * Script de prueba rápida para Ghost Drop
 * Ejecutar en la consola del navegador para diagnosticar problemas
 */

async function quickTest() {
  console.log('🧪 GHOST DROP - PRUEBA RÁPIDA');
  console.log('================================');
  
  const results = {
    supabase: false,
    crypto: false,
    b2Proxy: false,
    timers: false,
    i18n: false
  };
  
  // 1. Test Supabase
  try {
    console.log('1️⃣ Probando Supabase...');
    const { data, error } = await window.db.from('rooms').select('id').limit(1);
    if (!error) {
      results.supabase = true;
      console.log('✅ Supabase: OK');
    } else {
      console.error('❌ Supabase:', error.message);
    }
  } catch (e) {
    console.error('❌ Supabase:', e.message);
  }
  
  // 2. Test Crypto
  try {
    console.log('2️⃣ Probando cifrado...');
    if (window.crypto && window.crypto.subtle) {
      const testKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      if (testKey) {
        results.crypto = true;
        console.log('✅ Crypto: OK');
      }
    } else {
      console.error('❌ Crypto: Web Crypto API no disponible');
    }
  } catch (e) {
    console.error('❌ Crypto:', e.message);
  }
  
  // 3. Test B2 Proxy
  try {
    console.log('3️⃣ Probando proxy B2...');
    const endpoints = ['/health', '/api/health', 'http://localhost:3001/health'];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { timeout: 3000 });
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'ok') {
            results.b2Proxy = true;
            console.log(`✅ B2 Proxy: OK (${endpoint})`);
            break;
          }
        }
      } catch (e) {
        // Continuar con el siguiente endpoint
      }
    }
    
    if (!results.b2Proxy) {
      console.warn('⚠️ B2 Proxy: No disponible (solo archivos <50MB)');
    }
  } catch (e) {
    console.error('❌ B2 Proxy:', e.message);
  }
  
  // 4. Test Timers
  try {
    console.log('4️⃣ Probando timers...');
    
    // Verificar calibración de tiempo
    const offset = window.serverTimeOffset || 0;
    console.log(`   Offset del servidor: ${offset}ms`);
    
    // Test de función de tiempo
    const now = Date.now();
    const serverTime = now + offset;
    const testExpires = new Date(serverTime + 60000); // 1 minuto
    
    if (window.getSecsLeft) {
      const remaining = window.getSecsLeft(testExpires.toISOString());
      if (remaining > 50 && remaining < 70) {
        results.timers = true;
        console.log(`✅ Timers: OK (${remaining}s calculados correctamente)`);
      } else {
        console.error(`❌ Timers: Cálculo incorrecto (${remaining}s, esperado ~60s)`);
      }
    } else {
      console.error('❌ Timers: Función getSecsLeft no encontrada');
    }
  } catch (e) {
    console.error('❌ Timers:', e.message);
  }
  
  // 5. Test i18n
  try {
    console.log('5️⃣ Probando i18n...');
    if (window.i18n && typeof window.i18n.t === 'function') {
      const testText = window.i18n.t('statusNoRoom');
      if (testText && testText !== 'statusNoRoom') {
        results.i18n = true;
        console.log(`✅ i18n: OK (idioma: ${window.i18n.currentLang})`);
      } else {
        console.error('❌ i18n: Traducciones no cargadas');
      }
    } else {
      console.error('❌ i18n: Sistema no inicializado');
    }
  } catch (e) {
    console.error('❌ i18n:', e.message);
  }
  
  // Resumen
  console.log('\n📊 RESUMEN:');
  console.log('===========');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  console.log(`\n🎯 Resultado: ${passed}/${total} pruebas pasaron`);
  
  if (passed === total) {
    console.log('🎉 ¡Todo funcionando correctamente!');
  } else if (passed >= 3) {
    console.log('⚠️ Funcionalidad básica OK, algunos problemas menores');
  } else {
    console.log('🚨 Problemas críticos detectados');
    console.log('📖 Ver TROUBLESHOOTING.md para soluciones');
  }
  
  return results;
}

// Test específico para archivos grandes
async function testLargeFileUpload() {
  console.log('📁 TEST ARCHIVOS GRANDES');
  console.log('========================');
  
  // Verificar si B2 está disponible
  const b2Available = await window.testB2Connection?.() || false;
  
  if (!b2Available) {
    console.error('❌ B2 Proxy no disponible');
    console.log('💡 Soluciones:');
    console.log('   1. En desarrollo: npm run proxy');
    console.log('   2. Verificar .env.local con credenciales B2');
    console.log('   3. En producción: verificar deployment de Vercel');
    return false;
  }
  
  console.log('✅ B2 Proxy disponible');
  console.log('💡 Archivos >50MB deberían funcionar correctamente');
  return true;
}

// Test específico para timers
function testTimers() {
  console.log('⏰ TEST TIMERS');
  console.log('==============');
  
  const now = Date.now();
  const offset = window.serverTimeOffset || 0;
  
  console.log(`Tiempo local: ${new Date(now).toLocaleTimeString()}`);
  console.log(`Offset servidor: ${offset}ms`);
  console.log(`Tiempo servidor: ${new Date(now + offset).toLocaleTimeString()}`);
  
  // Test de cálculo
  const testExpires = new Date(now + offset + 120000); // 2 minutos
  const remaining = window.getSecsLeft?.(testExpires.toISOString()) || 0;
  
  console.log(`Tiempo restante calculado: ${remaining}s (esperado: ~120s)`);
  
  if (Math.abs(remaining - 120) < 5) {
    console.log('✅ Cálculo de tiempo correcto');
    return true;
  } else {
    console.error('❌ Cálculo de tiempo incorrecto');
    console.log('💡 Posibles causas:');
    console.log('   1. Problema de sincronización con servidor');
    console.log('   2. Función getSecsLeft con errores');
    console.log('   3. Offset del servidor mal calculado');
    return false;
  }
}

// Exponer funciones globalmente
window.quickTest = quickTest;
window.testLargeFileUpload = testLargeFileUpload;
window.testTimers = testTimers;

console.log('🧪 Scripts de prueba cargados:');
console.log('   quickTest() - Prueba completa');
console.log('   testLargeFileUpload() - Test archivos grandes');
console.log('   testTimers() - Test timers');