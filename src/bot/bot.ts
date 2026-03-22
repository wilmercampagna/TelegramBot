import { Bot } from 'grammy';
import logger from '../utils/logger';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // Log de chat ID para configurar grupos
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    const chatTitle = ctx.chat?.title || ctx.chat?.first_name || 'Privado';
    const chatType = ctx.chat?.type;
    logger.info(`Mensaje recibido | Chat: "${chatTitle}" | ID: ${chatId} | Tipo: ${chatType}`);
    await next();
  });

  bot.catch((err) => {
    logger.error(`Error en el bot: ${err.message}`);
  });

  return bot;
}
