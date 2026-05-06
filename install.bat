@echo off
REM 🚀 Script de instalación rápida para Ghost Drop v3.5.0 (Windows)

echo 👻 Ghost Drop - Instalación rápida
echo ==================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js no está instalado
    echo    Instala desde: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% detectado
echo.

REM Instalar dependencias
echo 📦 Instalando dependencias...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
)

echo ✅ Dependencias instaladas
echo.

REM Instalar Playwright
echo 🎭 Instalando Playwright...
call npx playwright install

if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Error instalando Playwright (opcional)
    echo    Puedes continuar sin tests automatizados
) else (
    echo ✅ Playwright instalado
)

echo.
echo ==================================
echo ✅ Instalación completa!
echo.
echo Próximos pasos:
echo.
echo 1. Configurar Supabase:
echo    - Edita supabase-config.js con tus credenciales
echo    - Sigue SETUP-SUPABASE.md
echo.
echo 2. Correr localmente:
echo    npx serve . -p 3000
echo    Abre http://localhost:3000
echo.
echo 3. Correr tests (opcional):
echo    npm test
echo.
echo 4. Configurar R2 para archivos grandes (opcional):
echo    Ver SETUP-R2.md
echo.
echo 5. Deploy a producción:
echo    vercel
echo.
echo 📚 Documentación completa: README.md
echo 🚀 Guía rápida: QUICK-START.md
echo.
echo ¡Buena suerte! 👻
echo.
pause
