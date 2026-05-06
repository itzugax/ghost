#!/bin/bash

# 🚀 Script de instalación rápida para Ghost Drop v3.5.0

echo "👻 Ghost Drop - Instalación rápida"
echo "=================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    echo "   Instala desde: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"
echo ""

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Error instalando dependencias"
    exit 1
fi

echo "✅ Dependencias instaladas"
echo ""

# Instalar Playwright
echo "🎭 Instalando Playwright..."
npx playwright install

if [ $? -ne 0 ]; then
    echo "⚠️  Error instalando Playwright (opcional)"
    echo "   Puedes continuar sin tests automatizados"
else
    echo "✅ Playwright instalado"
fi

echo ""
echo "=================================="
echo "✅ Instalación completa!"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Configurar Supabase:"
echo "   - Edita supabase-config.js con tus credenciales"
echo "   - Sigue SETUP-SUPABASE.md"
echo ""
echo "2. Correr localmente:"
echo "   npx serve . -p 3000"
echo "   Abre http://localhost:3000"
echo ""
echo "3. Correr tests (opcional):"
echo "   npm test"
echo ""
echo "4. Configurar R2 para archivos grandes (opcional):"
echo "   Ver SETUP-R2.md"
echo ""
echo "5. Deploy a producción:"
echo "   vercel"
echo ""
echo "📚 Documentación completa: README.md"
echo "🚀 Guía rápida: QUICK-START.md"
echo ""
echo "¡Buena suerte! 👻"
