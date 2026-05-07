/**
 * Health Check Script para Ghost Drop
 * Verifica que todos los componentes funcionen correctamente
 */

class HealthChecker {
  constructor() {
    this.results = {};
    this.errors = [];
  }

  async runAllChecks() {
    console.log('🏥 Iniciando verificación de salud del sistema...');
    
    await this.checkSupabase();
    await this.checkCrypto();
    await this.checkB2Proxy();
    await this.checkI18n();
    await this.checkLocalStorage();
    await this.checkNetworkConnectivity();
    
    this.displayResults();
    return this.results;
  }

  async checkSupabase() {
    try {
      if (!window.db) {
        throw new Error('Cliente de Supabase no inicializado');
      }

      // Test básico de conexión
      const { data, error } = await window.db
        .from('rooms')
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Error de Supabase: ${error.message}`);
      }

      this.results.supabase = { status: 'ok', message: 'Conexión exitosa' };
      console.log('✅ Supabase: OK');
    } catch (error) {
      this.results.supabase = { status: 'error', message: error.message };
      this.errors.push(`Supabase: ${error.message}`);
      console.error('❌ Supabase:', error.message);
    }
  }

  async checkCrypto() {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Web Crypto API no disponible');
      }

      // Test de cifrado básico
      const testData = new TextEncoder().encode('test');
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        testData
      );

      if (!encrypted) {
        throw new Error('Test de cifrado falló');
      }

      this.results.crypto = { status: 'ok', message: 'Cifrado E2E disponible' };
      console.log('✅ Crypto: OK');
    } catch (error) {
      this.results.crypto = { status: 'error', message: error.message };
      this.errors.push(`Crypto: ${error.message}`);
      console.error('❌ Crypto:', error.message);
    }
  }

  async checkB2Proxy() {
    try {
      console.log('🔍 Verificando proxy B2...');
      
      // Intentar diferentes endpoints
      const endpoints = [
        '/health',
        '/api/health', 
        'http://localhost:3001/health'
      ];
      
      let proxyWorking = false;
      let workingEndpoint = null;
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { 
            method: 'GET',
            timeout: 5000 
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'ok') {
              proxyWorking = true;
              workingEndpoint = endpoint;
              console.log(`✅ B2 Proxy funcionando en: ${endpoint}`);
              break;
            }
          }
        } catch (e) {
          console.log(`❌ B2 Proxy no disponible en: ${endpoint}`);
        }
      }
      
      if (proxyWorking) {
        this.results.b2Proxy = { 
          status: 'ok', 
          message: `Proxy B2 funcionando (${workingEndpoint})` 
        };
      } else {
        this.results.b2Proxy = { 
          status: 'warning', 
          message: 'Proxy B2 no disponible - solo archivos <50MB funcionarán' 
        };
      }
      
    } catch (error) {
      this.results.b2Proxy = { 
        status: 'warning', 
        message: `No disponible: ${error.message}` 
      };
      console.warn('⚠️ B2 Proxy:', error.message);
    }
  }

  async checkI18n() {
    try {
      if (!window.i18n) {
        throw new Error('Sistema i18n no inicializado');
      }

      const testKey = 'statusNoRoom';
      const translation = window.i18n.t(testKey);
      
      if (!translation || translation === testKey) {
        throw new Error('Traducciones no cargadas');
      }

      // Test de cambio de idioma
      const currentLang = window.i18n.currentLang;
      const expectedLangs = ['es', 'en'];
      
      if (!expectedLangs.includes(currentLang)) {
        throw new Error(`Idioma inválido: ${currentLang}`);
      }

      this.results.i18n = { 
        status: 'ok', 
        message: `Idioma activo: ${currentLang}` 
      };
      console.log('✅ i18n: OK');
    } catch (error) {
      this.results.i18n = { status: 'error', message: error.message };
      this.errors.push(`i18n: ${error.message}`);
      console.error('❌ i18n:', error.message);
    }
  }

  async checkLocalStorage() {
    try {
      const testKey = 'ghostdrop-health-test';
      const testValue = Date.now().toString();
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved !== testValue) {
        throw new Error('LocalStorage no funciona correctamente');
      }

      // Verificar espacio disponible (aproximado)
      const testData = 'x'.repeat(1024); // 1KB
      let maxSize = 0;
      try {
        for (let i = 0; i < 10000; i++) { // Test hasta 10MB
          localStorage.setItem(`test-${i}`, testData);
          maxSize += 1024;
        }
      } catch (e) {
        // Limpiar tests
        for (let i = 0; i < 10000; i++) {
          localStorage.removeItem(`test-${i}`);
        }
      }

      this.results.localStorage = { 
        status: 'ok', 
        message: `Disponible (~${Math.round(maxSize/1024)}KB libres)` 
      };
      console.log('✅ LocalStorage: OK');
    } catch (error) {
      this.results.localStorage = { status: 'error', message: error.message };
      this.errors.push(`LocalStorage: ${error.message}`);
      console.error('❌ LocalStorage:', error.message);
    }
  }

  async checkNetworkConnectivity() {
    try {
      if (!navigator.onLine) {
        throw new Error('Sin conexión a internet');
      }

      // Test de conectividad real
      const startTime = Date.now();
      const response = await fetch(window.SUPABASE_URL + '/rest/v1/', {
        method: 'HEAD',
        timeout: 10000
      });
      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Error de conectividad: HTTP ${response.status}`);
      }

      let quality = 'excelente';
      if (latency > 1000) quality = 'lenta';
      else if (latency > 500) quality = 'regular';
      else if (latency > 200) quality = 'buena';

      this.results.network = { 
        status: 'ok', 
        message: `Conectividad ${quality} (${latency}ms)` 
      };
      console.log('✅ Red: OK');
    } catch (error) {
      this.results.network = { status: 'error', message: error.message };
      this.errors.push(`Red: ${error.message}`);
      console.error('❌ Red:', error.message);
    }
  }

  displayResults() {
    console.log('\n📊 RESUMEN DE VERIFICACIÓN:');
    console.log('================================');
    
    const categories = [
      { key: 'supabase', name: 'Base de Datos' },
      { key: 'crypto', name: 'Cifrado E2E' },
      { key: 'b2Proxy', name: 'Archivos Grandes' },
      { key: 'i18n', name: 'Idiomas' },
      { key: 'localStorage', name: 'Almacenamiento Local' },
      { key: 'network', name: 'Conectividad' }
    ];

    categories.forEach(({ key, name }) => {
      const result = this.results[key];
      if (!result) return;

      const icon = result.status === 'ok' ? '✅' : 
                   result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${name}: ${result.message}`);
    });

    if (this.errors.length > 0) {
      console.log('\n🚨 ERRORES CRÍTICOS:');
      this.errors.forEach(error => console.log(`   • ${error}`));
      console.log('\n📖 Ver TROUBLESHOOTING.md para soluciones');
    } else {
      console.log('\n🎉 ¡Todos los sistemas funcionando correctamente!');
    }
  }

  // Método para mostrar ayuda contextual
  showHelp() {
    const help = {
      supabase: 'Verificar supabase-config.js y credenciales',
      crypto: 'Usar HTTPS o localhost. Verificar navegador compatible',
      b2Proxy: 'Configurar .env.local y ejecutar npm run proxy',
      i18n: 'Recargar página o verificar i18n.js',
      localStorage: 'Limpiar datos del navegador o usar modo incógnito',
      network: 'Verificar conexión a internet'
    };

    console.log('\n🆘 AYUDA RÁPIDA:');
    Object.entries(help).forEach(([key, solution]) => {
      if (this.results[key]?.status !== 'ok') {
        console.log(`   ${key}: ${solution}`);
      }
    });
  }
}

// Exponer globalmente
window.HealthChecker = HealthChecker;

// Auto-ejecutar en desarrollo
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.addEventListener('load', () => {
    setTimeout(async () => {
      const checker = new HealthChecker();
      const results = await checker.runAllChecks();
      
      // Mostrar ayuda si hay errores
      if (checker.errors.length > 0) {
        checker.showHelp();
      }
      
      // Exponer para debugging
      window.lastHealthCheck = results;
    }, 2000);
  });
}

// Comando rápido para verificación manual
window.healthCheck = async () => {
  const checker = new HealthChecker();
  return await checker.runAllChecks();
};