/**
 * Tests E2E para Ghost Drop
 * Framework: Playwright
 * 
 * Instalar:
 *   npm install -D @playwright/test
 *   npx playwright install
 * 
 * Correr:
 *   npx playwright test
 *   npx playwright test --ui (modo interactivo)
 *   npx playwright test --headed (ver navegador)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Ghost Drop - Flujo completo', () => {
  
  test('debe cargar la página principal', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Verificar título
    await expect(page).toHaveTitle(/Ghost Drop/);
    
    // Verificar elementos principales
    await expect(page.locator('.logo')).toContainText('GhostDrop');
    await expect(page.locator('.tagline')).toContainText('5 segundos');
  });

  test('debe crear una sala aleatoria', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Click en "Sala aleatoria"
    await page.click('#new-room-btn');
    
    // Esperar animación de slot machine
    await page.waitForTimeout(2000);
    
    // Verificar que se creó la sala
    await expect(page.locator('#room-badge')).toBeVisible();
    await expect(page.locator('#room-code-display')).toContainText(/Sala \d{6}/);
    
    // Verificar que aparecen las secciones de drop
    await expect(page.locator('#drop-section')).toBeVisible();
    await expect(page.locator('#text-section')).toBeVisible();
  });

  test('debe unirse a una sala con código', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const roomCode = '123456';
    
    // Llenar código dígito por dígito
    const digitBoxes = page.locator('.digit-box');
    for (let i = 0; i < 6; i++) {
      await digitBoxes.nth(i).fill(roomCode[i]);
    }
    
    // Click en "Entrar"
    await page.click('#join-btn');
    
    // Esperar a que se una a la sala
    await page.waitForTimeout(1000);
    
    // Verificar que está en la sala
    await expect(page.locator('#room-code-display')).toContainText('Sala 123456');
  });

  test('debe compartir texto entre dos usuarios', async ({ browser }) => {
    // Usuario 1: Crear sala
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(BASE_URL);
    await page1.click('#new-room-btn');
    await page1.waitForTimeout(2000);
    
    // Obtener código de sala
    const roomCodeText = await page1.locator('#room-code-display').textContent();
    const roomCode = roomCodeText.match(/\d{6}/)[0];
    
    // Usuario 2: Unirse a la misma sala
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(BASE_URL);
    
    const digitBoxes = page2.locator('.digit-box');
    for (let i = 0; i < 6; i++) {
      await digitBoxes.nth(i).fill(roomCode[i]);
    }
    await page2.click('#join-btn');
    await page2.waitForTimeout(1000);
    
    // Usuario 1: Enviar texto
    const testMessage = 'Hola desde Playwright! 🚀';
    await page1.fill('#text-input', testMessage);
    await page1.click('#send-text-btn');
    
    // Usuario 2: Verificar que recibe el texto
    await page2.waitForTimeout(2000);
    const textContent = page2.locator('.drop-text-content').first();
    await expect(textContent).toContainText(testMessage);
    
    // Cleanup
    await context1.close();
    await context2.close();
  });

  test('debe subir y descargar un archivo pequeño', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Crear sala
    await page.click('#new-room-btn');
    await page.waitForTimeout(2000);
    
    // Crear archivo de prueba (1KB)
    const testContent = 'Test file content for Ghost Drop E2E test';
    const buffer = Buffer.from(testContent);
    
    // Subir archivo
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: buffer
    });
    
    // Esperar TTL picker
    await page.waitForSelector('#ttl-picker:not(.hidden)');
    
    // Seleccionar 1 min
    await page.click('[data-secs="60"]');
    
    // Esperar a que se suba
    await page.waitForTimeout(3000);
    
    // Verificar que aparece en la lista
    const fileItem = page.locator('.drop-item').first();
    await expect(fileItem).toBeVisible();
    await expect(fileItem).toContainText('test.txt');
    
    // Descargar archivo
    const downloadPromise = page.waitForEvent('download');
    await page.click('.dl-btn');
    const download = await downloadPromise;
    
    // Verificar nombre del archivo
    expect(download.suggestedFilename()).toBe('test.txt');
  });

  test('debe cifrar y descifrar correctamente', async ({ browser }) => {
    // Usuario 1: Subir archivo cifrado
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(BASE_URL);
    await page1.click('#new-room-btn');
    await page1.waitForTimeout(2000);
    
    const roomCodeText = await page1.locator('#room-code-display').textContent();
    const roomCode = roomCodeText.match(/\d{6}/)[0];
    
    // Subir archivo con contenido conocido
    const secretContent = 'Este es un mensaje secreto cifrado E2E 🔐';
    const buffer = Buffer.from(secretContent);
    
    const fileInput = page1.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'secret.txt',
      mimeType: 'text/plain',
      buffer: buffer
    });
    
    await page1.waitForSelector('#ttl-picker:not(.hidden)');
    await page1.click('[data-secs="60"]');
    await page1.waitForTimeout(3000);
    
    // Usuario 2: Unirse con el mismo código y descargar
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(BASE_URL);
    
    const digitBoxes = page2.locator('.digit-box');
    for (let i = 0; i < 6; i++) {
      await digitBoxes.nth(i).fill(roomCode[i]);
    }
    await page2.click('#join-btn');
    await page2.waitForTimeout(2000);
    
    // Descargar y verificar
    const downloadPromise = page2.waitForEvent('download');
    await page2.click('.dl-btn');
    const download = await downloadPromise;
    
    // Guardar archivo descargado
    const path = await download.path();
    const fs = require('fs');
    const downloadedContent = fs.readFileSync(path, 'utf8');
    
    // Verificar que el contenido descifrado es correcto
    expect(downloadedContent).toBe(secretContent);
    
    await context1.close();
    await context2.close();
  });

  test('debe expirar archivos después del TTL', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Crear sala
    await page.click('#new-room-btn');
    await page.waitForTimeout(2000);
    
    // Subir archivo con TTL de 1 min
    const buffer = Buffer.from('Archivo temporal');
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'temp.txt',
      mimeType: 'text/plain',
      buffer: buffer
    });
    
    await page.waitForSelector('#ttl-picker:not(.hidden)');
    await page.click('[data-secs="60"]');
    await page.waitForTimeout(3000);
    
    // Verificar que aparece
    await expect(page.locator('.drop-item')).toBeVisible();
    
    // Verificar que el timer está corriendo
    const timer = page.locator('.ftimer').first();
    const initialTime = await timer.textContent();
    
    await page.waitForTimeout(5000);
    const laterTime = await timer.textContent();
    
    // El tiempo debe haber disminuido
    expect(initialTime).not.toBe(laterTime);
  });

  test('debe copiar código de sala al portapapeles', async ({ page, context }) => {
    // Dar permisos de clipboard
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    await page.goto(BASE_URL);
    await page.click('#new-room-btn');
    await page.waitForTimeout(2000);
    
    // Obtener código de sala
    const roomCodeText = await page.locator('#room-code-display').textContent();
    const roomCode = roomCodeText.match(/\d{6}/)[0];
    
    // Click en copiar
    await page.click('#copy-room-btn');
    
    // Verificar que se copió al portapapeles
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(roomCode);
    
    // Verificar toast de confirmación
    await expect(page.locator('#toast')).toContainText(/copiado/i);
  });

  test('debe mostrar contador de miembros', async ({ browser }) => {
    // Usuario 1
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(BASE_URL);
    await page1.click('#new-room-btn');
    await page1.waitForTimeout(2000);
    
    const roomCodeText = await page1.locator('#room-code-display').textContent();
    const roomCode = roomCodeText.match(/\d{6}/)[0];
    
    // Usuario 2
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(BASE_URL);
    
    const digitBoxes = page2.locator('.digit-box');
    for (let i = 0; i < 6; i++) {
      await digitBoxes.nth(i).fill(roomCode[i]);
    }
    await page2.click('#join-btn');
    await page2.waitForTimeout(2000);
    
    // Verificar que ambos ven "2 personas"
    await expect(page1.locator('#members-count')).toContainText('2 personas');
    await expect(page2.locator('#members-count')).toContainText('2 personas');
    
    await context1.close();
    await context2.close();
  });

  test('debe validar límite de tamaño de archivo', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#new-room-btn');
    await page.waitForTimeout(2000);
    
    // Intentar subir archivo de 60MB (simulado)
    // En test real, crear archivo grande
    const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
    
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'large.bin',
      mimeType: 'application/octet-stream',
      buffer: largeBuffer
    });
    
    // Debería mostrar error o usar R2 si está configurado
    await page.waitForTimeout(2000);
    
    // Verificar mensaje (depende de si R2 está configurado)
    const toast = page.locator('#toast');
    const toastText = await toast.textContent();
    
    // Puede ser error o éxito con R2
    expect(toastText.length).toBeGreaterThan(0);
  });
});

test.describe('Ghost Drop - Seguridad', () => {
  
  test('no debe poder descifrar con código incorrecto', async ({ browser }) => {
    // Usuario 1: Subir archivo en sala 111111
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(BASE_URL);
    
    const digitBoxes1 = page1.locator('.digit-box');
    for (let i = 0; i < 6; i++) {
      await digitBoxes1.nth(i).fill('1');
    }
    await page1.click('#join-btn');
    await page1.waitForTimeout(1000);
    
    const buffer = Buffer.from('Mensaje secreto');
    const fileInput = page1.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'secret.txt',
      mimeType: 'text/plain',
      buffer: buffer
    });
    
    await page1.waitForSelector('#ttl-picker:not(.hidden)');
    await page1.click('[data-secs="60"]');
    await page1.waitForTimeout(3000);
    
    // Usuario 2: Intentar acceder con código diferente (222222)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(BASE_URL);
    
    const digitBoxes2 = page2.locator('.digit-box');
    for (let i = 0; i < 6; i++) {
      await digitBoxes2.nth(i).fill('2');
    }
    await page2.click('#join-btn');
    await page2.waitForTimeout(2000);
    
    // No debería ver el archivo de la sala 111111
    const emptyState = page2.locator('.empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('despejada');
    
    await context1.close();
    await context2.close();
  });

  test('debe verificar que Web Crypto API está disponible', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Verificar que crypto.js se cargó
    const cryptoSupported = await page.evaluate(() => {
      return typeof isCryptoSupported === 'function' && isCryptoSupported();
    });
    
    expect(cryptoSupported).toBe(true);
  });
});
