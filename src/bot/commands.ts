import { Bot } from 'grammy';
import { registerGestionarCommand } from './commands/gestionar';
import { registerConsultaCommands } from './commands/consultas';
import { registerResponderCommand } from './commands/responder';

export function registerCommands(bot: Bot): void {
  // Comandos basicos
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Bot de Gestion Documental activo.\n\n' +
      'Para gestionar un documento, responde al documento con /gestionar.\n\n' +
      'Usa /help para ver todos los comandos disponibles.'
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Comandos disponibles:\n\n' +
      '/gestionar - Responde a un documento para procesarlo\n' +
      '/responder <codigo> <codigo_resp> - Marcar oficio como respondido\n' +
      '/oficios - Ver todos los oficios registrados\n' +
      '/revision - Ver oficios pendientes de respuesta\n' +
      '/respondidos - Ver oficios ya respondidos\n' +
      '/buscar <texto> - Buscar oficios por codigo o asunto\n' +
      '/detalle <codigo> - Ver informacion completa de un oficio\n' +
      '/help - Mostrar esta ayuda'
    );
  });

  // Gestion de documentos
  registerGestionarCommand(bot);

  // Responder oficios
  registerResponderCommand(bot);

  // Consultas
  registerConsultaCommands(bot);
}
