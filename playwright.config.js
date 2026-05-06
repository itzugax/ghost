import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para Ghost Drop
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Timeout por test (30 segundos)
  timeout: 30 * 1000,
  
  // Reintentos en caso de fallo
  retries: process.env.CI ? 2 : 0,
  
  // Workers paralelos
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter
  reporter: [
    ['html'],
    ['list']
  ],
  
  use: {
    // Base URL
    baseURL: 'http://localhost:3000',
    
    // Screenshot en fallo
    screenshot: 'only-on-failure',
    
    // Video en fallo
    video: 'retain-on-failure',
    
    // Trace en fallo
    trace: 'on-first-retry',
  },

  // Proyectos (navegadores)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Servidor local (levanta automáticamente)
  webServer: {
    command: 'npx serve . -p 3000',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
