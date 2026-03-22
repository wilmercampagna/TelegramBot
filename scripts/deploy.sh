#!/bin/bash
# Script de deploy / actualizacion del bot
# Ejecutar desde /home/azureuser/TelegramBot

set -e

echo "=== Instalando dependencias ==="
npm ci --production=false

echo "=== Compilando TypeScript ==="
npm run build

echo "=== Creando carpeta de logs ==="
mkdir -p logs

echo "=== Iniciando bot con PM2 ==="
pm2 stop telegram-doc-bot 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "=== Configurando inicio automatico ==="
pm2 startup systemd -u azureuser --hp /home/azureuser 2>/dev/null || true
pm2 save

echo ""
echo "=== Bot desplegado ==="
echo "Comandos utiles:"
echo "  pm2 status          - Ver estado del bot"
echo "  pm2 logs            - Ver logs en tiempo real"
echo "  pm2 restart all     - Reiniciar bot"
echo "  pm2 stop all        - Detener bot"
