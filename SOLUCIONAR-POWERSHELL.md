# 🔧 Solucionar error de PowerShell

## ⚠️ Error que tienes

```
No se puede cargar el archivo porque la ejecución de scripts está deshabilitada
```

---

## ✅ Solución rápida (30 segundos)

### Opción 1: Habilitar scripts (Recomendado)

1. **Abre PowerShell como Administrador:**
   - Click derecho en el menú Inicio
   - "Windows PowerShell (Administrador)" o "Terminal (Administrador)"

2. **Ejecuta este comando:**
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

3. **Confirma con "S" (Sí)**

4. **Cierra y abre PowerShell normal** (sin administrador)

5. **Prueba:**
   ```powershell
   npm -v
   ```

---

### Opción 2: Usar CMD en vez de PowerShell

Si no quieres cambiar la política de ejecución:

1. **Abre CMD** (Símbolo del sistema)
   - Presiona `Win + R`
   - Escribe `cmd`
   - Enter

2. **Navega a tu proyecto:**
   ```cmd
   cd C:\Users\PC\Desktop\Nueva carpeta\ghost-main
   ```

3. **Ejecuta los comandos:**
   ```cmd
   npm install
   npx playwright install
   npm test
   ```

---

### Opción 3: Usar Git Bash (si lo tienes instalado)

Si tienes Git instalado:

1. Click derecho en la carpeta del proyecto
2. "Git Bash Here"
3. Ejecuta:
   ```bash
   npm install
   npx playwright install
   npm test
   ```

---

## 🎯 Mi recomendación

**Usa Opción 2 (CMD)** - Es más simple y no requiere cambiar configuraciones.

---

## ✅ Verificar que funciona

En CMD:
```cmd
node -v
npm -v
npm install
```

Deberías ver que empieza a instalar paquetes.

---

## 🐛 Si sigue sin funcionar

Reinicia Windows y prueba de nuevo.
