import { Bot, CommandContext, Context } from 'grammy';
import { getAllEntries, getEntriesEnRevision, getEntriesRespondidos, searchEntries, findEntryByCode } from '../../services/excel.service';
import { getGroupConfig } from '../../utils/config';
import { ExcelRow } from '../../types/document.types';
import { GroupConfig } from '../../types/config.types';

export function registerConsultaCommands(bot: Bot): void {
  bot.command('oficios', handleOficios);
  bot.command('revision', handleRevision);
  bot.command('respondidos', handleRespondidos);
  bot.command('buscar', handleBuscar);
  bot.command('detalle', handleDetalle);
}

function getConfig(ctx: CommandContext<Context>): GroupConfig | undefined {
  return getGroupConfig(ctx.chat?.id || 0);
}

async function handleOficios(ctx: CommandContext<Context>): Promise<void> {
  const config = getConfig(ctx);
  if (!config) { await ctx.reply('Grupo no configurado.'); return; }

  try {
    const entries = await getAllEntries(config.onedriveFolderPath, config.excelFileName);
    if (entries.length === 0) {
      await ctx.reply('No hay oficios registrados.');
      return;
    }
    await sendLongMessage(ctx, formatEntryList('Oficios registrados', entries));
  } catch (error) {
    await ctx.reply(`Error al consultar oficios: ${errorMsg(error)}`);
  }
}

async function handleRevision(ctx: CommandContext<Context>): Promise<void> {
  const config = getConfig(ctx);
  if (!config) { await ctx.reply('Grupo no configurado.'); return; }

  try {
    const entries = await getEntriesEnRevision(config.onedriveFolderPath, config.excelFileName);
    if (entries.length === 0) {
      await ctx.reply('No hay oficios pendientes de respuesta.');
      return;
    }
    await sendLongMessage(ctx, formatEntryList('Oficios en revision', entries));
  } catch (error) {
    await ctx.reply(`Error: ${errorMsg(error)}`);
  }
}

async function handleRespondidos(ctx: CommandContext<Context>): Promise<void> {
  const config = getConfig(ctx);
  if (!config) { await ctx.reply('Grupo no configurado.'); return; }

  try {
    const entries = await getEntriesRespondidos(config.onedriveFolderPath, config.excelFileName);
    if (entries.length === 0) {
      await ctx.reply('No hay oficios respondidos aun.');
      return;
    }
    await sendLongMessage(ctx, formatRespondidosList(entries));
  } catch (error) {
    await ctx.reply(`Error: ${errorMsg(error)}`);
  }
}

async function handleBuscar(ctx: CommandContext<Context>): Promise<void> {
  const config = getConfig(ctx);
  if (!config) { await ctx.reply('Grupo no configurado.'); return; }

  const query = ctx.match?.toString().trim();
  if (!query) {
    await ctx.reply('Uso: /buscar <texto>\nEjemplo: /buscar topografia\nEjemplo: /buscar C4234-585');
    return;
  }

  try {
    const entries = await searchEntries(config.onedriveFolderPath, config.excelFileName, query);
    if (entries.length === 0) {
      await ctx.reply(`No se encontraron oficios con: "${query}"`);
      return;
    }
    await sendLongMessage(ctx, formatEntryList(`Resultados para "${query}"`, entries));
  } catch (error) {
    await ctx.reply(`Error: ${errorMsg(error)}`);
  }
}

async function handleDetalle(ctx: CommandContext<Context>): Promise<void> {
  const config = getConfig(ctx);
  if (!config) { await ctx.reply('Grupo no configurado.'); return; }

  const code = ctx.match?.toString().trim();
  if (!code) {
    await ctx.reply('Uso: /detalle <codigo>\nEjemplo: /detalle C4234-585-2024');
    return;
  }

  try {
    const found = await findEntryByCode(config.onedriveFolderPath, config.excelFileName, code);
    if (!found) {
      await ctx.reply(`No se encontro oficio con codigo: ${code}`);
      return;
    }
    await ctx.reply(formatDetalle(found.entry));
  } catch (error) {
    await ctx.reply(`Error: ${errorMsg(error)}`);
  }
}

// --- Formatters ---

function formatEntryList(title: string, entries: ExcelRow[]): string {
  const lines: string[] = [`${title} (${entries.length}):\n`];

  entries.forEach((e, i) => {
    lines.push(`${i + 1}. [${e.estado || 'Sin estado'}] ${e.code}`);
    lines.push(`   Asunto: ${e.asunto.substring(0, 80)}`);
    lines.push(`   Fecha doc: ${e.fechaDocumento} | Recepcion: ${e.fechaRecepcion}`);
    if (e.codeRespuesta) {
      lines.push(`   Respuesta: ${e.codeRespuesta} (${e.fechaRespuesta})`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

function formatRespondidosList(entries: ExcelRow[]): string {
  const lines: string[] = [`Oficios respondidos (${entries.length}):\n`];

  entries.forEach((e, i) => {
    lines.push(`${i + 1}. ${e.code} -> ${e.codeRespuesta}`);
    lines.push(`   Asunto: ${e.asunto.substring(0, 80)}`);
    lines.push(`   Fecha respuesta: ${e.fechaRespuesta}`);
    lines.push('');
  });

  return lines.join('\n');
}

function formatDetalle(entry: ExcelRow): string {
  const lines = [
    '=== Detalle del Oficio ===',
    '',
    `Codigo: ${entry.code}`,
    `Asunto: ${entry.asunto}`,
    `Fecha del documento: ${entry.fechaDocumento}`,
    `Fecha de recepcion: ${entry.fechaRecepcion}`,
    `Estado: ${entry.estado}`,
  ];

  if (entry.codeRespuesta) {
    lines.push(`Codigo de respuesta: ${entry.codeRespuesta}`);
    lines.push(`Fecha de respuesta: ${entry.fechaRespuesta}`);
  }

  return lines.join('\n');
}

// --- Helpers ---

function errorMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido';
}

async function sendLongMessage(ctx: CommandContext<Context>, text: string): Promise<void> {
  // Telegram limita mensajes a 4096 caracteres
  if (text.length <= 4096) {
    await ctx.reply(text);
    return;
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 4096) {
      chunks.push(remaining);
      break;
    }
    const cutPoint = remaining.lastIndexOf('\n', 4096);
    const end = cutPoint > 0 ? cutPoint : 4096;
    chunks.push(remaining.substring(0, end));
    remaining = remaining.substring(end);
  }

  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}
