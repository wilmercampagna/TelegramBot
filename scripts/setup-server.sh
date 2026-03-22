#!/bin/bash
# Script de configuracion inicial del servidor Azure VM
# Ejecutar como: bash setup-server.sh

set -e

echo "=== Actualizando sistema ==="
sudo apt update && sudo apt upgrade -y

echo "=== Instalando Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "=== Instalando PM2 ==="
sudo npm install -g pm2

echo "=== Instalando Git ==="
sudo apt install -y git

echo "=== Clonando repositorio ==="
cd /home/azureuser
if [ ! -d "TelegramBot" ]; then
  echo "Clona tu repositorio aqui:"
  echo "  git clone <tu-repo-url> TelegramBot"
  echo ""
  echo "O sube los archivos manualmente con scp."
  echo "Luego continua con: bash scripts/deploy.sh"
else
  echo "Directorio TelegramBot ya existe."
fi

echo ""
echo "=== Servidor configurado ==="
echo ""
echo "Pasos siguientes:"
echo "  1. Clonar o subir el proyecto a /home/azureuser/TelegramBot"
echo "  2. Crear el archivo .env con las credenciales"
echo "  3. Ejecutar: bash scripts/deploy.sh"
