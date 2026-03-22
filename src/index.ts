import dotenv from 'dotenv';
dotenv.config();

import { createBot } from './bot/bot';
import { registerCommands } from './bot/commands';
import { verifyGraphConnection } from './auth/graph-auth';
import { startNotificationScheduler, stopNotificationScheduler } from './services/notifications.service';
import logger from './utils/logger';

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    logger.error('BOT_TOKEN no encontrado en .env');
    process.exit(1);
  }

  // Verificar conexion con Microsoft Graph si esta configurado
  if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_ID !== 'tu_client_id_aqui') {
    logger.info('Verificando conexion con Microsoft Graph...');
    const connected = await verifyGraphConnection();
    if (!connected) {
      logger.warn('No se pudo conectar a Microsoft Graph. La subida a OneDrive no funcionara.');
    }
  } else {
    logger.warn('AZURE_CLIENT_ID no configurado. La subida a OneDrive esta deshabilitada.');
  }

  const bot = createBot(token);
  registerCommands(bot);

  bot.start({
    onStart: () => {
      logger.info('Bot de Gestion Documental iniciado correctamente');
      startNotificationScheduler(bot);
    },
  });

  process.on('SIGINT', () => {
    logger.info('Deteniendo bot...');
    stopNotificationScheduler();
    bot.stop();
  });

  process.on('SIGTERM', () => {
    logger.info('Deteniendo bot...');
    stopNotificationScheduler();
    bot.stop();
  });
}

main();
