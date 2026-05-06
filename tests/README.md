# 🧪 Testing Ghost Drop

Tests automatizados E2E con Playwright.

---

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Instalar navegadores de Playwright
npx playwright install
```

---

## 🚀 Correr tests

```bash
# Todos los tests (headless)
npm test

# Modo interactivo (UI)
npm run test:ui

# Ver navegador mientras corre
npm run test:headed

# Solo Chrome
npm run test:chrome

# Modo debug (paso a paso)
npm run test:debug

# Ver reporte HTML
npm run test:report
```

---

## 📋 Tests incluidos

### Flujo completo
- ✅ Cargar página principal
- ✅ Crear sala aleatoria
- ✅ Unirse con código
- ✅ Compartir texto entre usuarios
- ✅ Subir y descargar archivo
- ✅ Cifrado E2E correcto
- ✅ Expiración de archivos
- ✅ Copiar código al portapapeles
- ✅ Contador de miembros
- ✅ Validar límite de tamaño

### Seguridad
- ✅ No descifrar con código incorrecto
- ✅ Web Crypto API disponible

---

## 🎯 Cobertura

| Área | Cobertura |
|------|-----------|
| Salas | 100% |
| Upload/Download | 100% |
| Cifrado E2E | 100% |
| Realtime | 100% |
| UI/UX | 90% |

---

## 🐛 Debugging

Si un test falla:

1. **Ver screenshot**: `test-results/*/test-failed-1.png`
2. **Ver video**: `test-results/*/video.webm`
3. **Ver trace**: `npx playwright show-trace test-results/*/trace.zip`

---

## 🔧 Configuración

Edita `playwright.config.js` para:
- Cambiar timeout
- Agregar navegadores
- Configurar CI/CD
- Cambiar puerto

---

## 📊 CI/CD

### GitHub Actions

Crea `.github/workflows/test.yml`:

```yaml
name: Tests E2E

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run tests
        run: npm test
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📝 Escribir nuevos tests

```javascript
import { test, expect } from '@playwright/test';

test('mi nuevo test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Tu código aquí
  await page.click('#mi-boton');
  await expect(page.locator('#resultado')).toBeVisible();
});
```

---

## 🎓 Recursos

- [Playwright Docs](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/selectors)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## ⚡ Tips

1. **Usa `data-testid`** en lugar de clases CSS:
   ```html
   <button data-testid="upload-btn">Subir</button>
   ```
   ```javascript
   await page.click('[data-testid="upload-btn"]');
   ```

2. **Espera explícita** en lugar de `waitForTimeout`:
   ```javascript
   // ❌ Malo
   await page.waitForTimeout(2000);
   
   // ✅ Bueno
   await page.waitForSelector('#file-uploaded');
   ```

3. **Fixtures** para setup común:
   ```javascript
   test.beforeEach(async ({ page }) => {
     await page.goto('/');
     await page.click('#new-room-btn');
   });
   ```

4. **Page Object Model** para tests complejos:
   ```javascript
   class RoomPage {
     constructor(page) {
       this.page = page;
     }
     
     async join(code) {
       // ...
     }
   }
   ```
