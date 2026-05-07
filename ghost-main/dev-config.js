/**
 * Configuración para desarrollo local
 * Este archivo ayuda a configurar el entorno de desarrollo
 */

// Verificar configuración de Supabase
function checkSupabaseConfig() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error('❌ Configuración de Supabase faltante');
    console.log('📝 Edita supabase-config.js con tus credenciales');
    return false;
  }
  
  if (window.SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
    console.error('❌ URL de Supabase no configurada');
    return false;
  }
  
  console.log('✅ Configuración de Supabase OK');
  return true;
}

// Verificar configuración de B2
async function checkB2Config() {
  try {
    const response = await fetch('/health');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Proxy B2 funcionando:', data);
      return true;
    } else {
      console.warn('⚠️ Proxy B2 no disponible - archivos >50MB no funcionarán');
      return false;
    }
  } catch (error) {
    console.warn('⚠️ Proxy B2 no disponible:', error.message);
    return false;
  }
}

// Verificar Web Crypto API
function checkCrypto() {
  if (!window.crypto || !window.crypto.subtle) {
    console.error('❌ Web Crypto API no disponible');
    console.log('🔒 El cifrado E2E no funcionará');
    return false;
  }
  console.log('✅ Web Crypto API disponible');
  return true;
}

// Verificar todas las configuraciones
async function checkDevEnvironment() {
  console.log('🔍 Verificando entorno de desarrollo...');
  
  const supabaseOK = checkSupabaseConfig();
  const cryptoOK = checkCrypto();
  const b2OK = await checkB2Config();
  
  if (supabaseOK && cryptoOK) {
    console.log('✅ Entorno básico configurado correctamente');
    if (b2OK) {
      console.log('✅ Todas las funciones disponibles');
    } else {
      console.log('⚠️ Solo archivos hasta 50MB (sin B2)');
    }
  } else {
    console.error('❌ Configuración incompleta');
  }
  
  return { supabaseOK, cryptoOK, b2OK };
}

// Exponer funciones para debugging
window.devConfig = {
  checkSupabaseConfig,
  checkB2Config,
  checkCrypto,
  checkDevEnvironment
};

// Auto-verificar en desarrollo
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.addEventListener('load', () => {
    setTimeout(checkDevEnvironment, 1000);
  });
}