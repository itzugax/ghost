# 📦 Instalar Node.js en Windows

## ⚠️ Problema detectado

Tu sistema no tiene Node.js instalado. Los comandos `npm`, `npx` y `vercel` requieren Node.js.

---

## 🚀 Solución: Instalar Node.js (5 minutos)

### Opción 1: Instalador oficial (Recomendado)

1. **Descargar Node.js:**
   - Ve a: https://nodejs.org/
   - Descarga la versión **LTS** (Long Term Support)
   - Archivo: `node-v20.x.x-x64.msi` (aprox. 30MB)

2. **Instalar:**
   - Doble click en el archivo descargado
   - Click "Next" en todo
   - ✅ Asegúrate de marcar "Add to PATH"
   - Click "Install"
   - Espera 2-3 minutos

3. **Verificar instalación:**
   - Cierra y abre PowerShell de nuevo
   - Ejecuta:
     ```powershell
     node -v
     npm -v
     ```
   - Deberías ver algo como:
     ```
     v20.11.0
     10.2.4
     ```

---

### Opción 2: Winget (Windows 11)

Si tienes Windows 11, puedes usar winget:

```powershell
winget install OpenJS.NodeJS.LTS
```

Luego cierra y abre PowerShell de nuevo.

---

### Opción 3: Chocolatey

Si tienes Chocolatey instalado:

```powershell
choco install nodejs-lts
```

---

## ✅ Después de instalar Node.js

### 1. Verificar instalación

Cierra y abre PowerShell, luego:

```powershell
node -v
npm -v
npx -v
```

Deberías ver las versiones instaladas.

---

### 2. Instalar Ghost Drop

Ahora sí puedes instalar las dependencias:

```powershell
# Opción A: Script automático (Windows)
.\install.bat

# Opción B: Manual
npm install
npx playwright install
npm test
```

---

### 3. Correr localmente

```powershell
npx serve . -p 3000
```

Abre http://localhost:3000 en tu navegador.

---

### 4. Deploy a Vercel (opcional)

```powershell
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel
```

---

## 🐛 Problemas comunes

### "npm no se reconoce"

**Causa:** Node.js no está en el PATH o PowerShell no se reinició.

**Solución:**
1. Cierra PowerShell completamente
2. Abre PowerShell de nuevo
3. Prueba `node -v`
4. Si sigue sin funcionar, reinicia Windows

---

### "Execution policy error"

Si ves un error de "execution policy":

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

### "npx playwright install" falla

**Causa:** Falta espacio en disco o permisos.

**Solución:**
```powershell
# Correr como Administrador
npx playwright install --with-deps
```

---

## 📊 Requisitos del sistema

| Requisito | Mínimo | Recomendado |
|-----------|--------|-------------|
| Windows | 10 | 11 |
| RAM | 4 GB | 8 GB |
| Espacio | 500 MB | 2 GB |
| Internet | Sí | Sí |

---

## 🎯 Checklist post-instalación

```powershell
# 1. Verificar Node.js
node -v
npm -v

# 2. Instalar dependencias
npm install

# 3. Instalar Playwright
npx playwright install

# 4. Correr tests
npm test

# 5. Correr localmente
npx serve . -p 3000
```

---

## 🆘 Ayuda adicional

### Node.js no instala

- Verifica que tienes permisos de administrador
- Desactiva temporalmente el antivirus
- Descarga de nuevo el instalador

### npm install falla

```powershell
# Limpiar caché
npm cache clean --force

# Intentar de nuevo
npm install
```

### Playwright no instala navegadores

```powershell
# Instalar con dependencias del sistema
npx playwright install --with-deps chromium
```

---

## 📚 Recursos

- **Node.js oficial:** https://nodejs.org/
- **Documentación npm:** https://docs.npmjs.com/
- **Playwright docs:** https://playwright.dev/

---

## ✅ Una vez instalado Node.js

Vuelve a `LEEME-PRIMERO.md` y sigue los pasos normales:

1. ✅ Node.js instalado
2. `npm install`
3. `npx playwright install`
4. `npm test`
5. `npx serve . -p 3000`

---

**¡Buena suerte! 🚀**
