import { Bot, CommandContext, Context } from 'grammy';
import { updateEntryStatus, findEntryByCode } from '../../services/excel.service';
import { generateDraftResponse } from '../../services/docgen.service';
import { uploadFile, ensureFolderExists } from '../../services/onedrive.service';
import { getGroupConfig } from '../../utils/config';
import { getCachedDocumentData } from '../../utils/cache';
import { DocumentData } from '../../types/document.types';
import { InputFile } from 'grammy';
import logger from '../../utils/logger';

export function registerResponderCommand(bot: Bot): void {
  bot.command('responder', handleResponder);
}

async function handleResponder(ctx: CommandContext<Context>): Promise<void> {
  const config = getGroupConfig(ctx.chat?.id || 0);
  if (!config) {
    await ctx.reply('Grupo no configurado.');
    return;
  }

  const args = ctx.match?.toString().trim();
  if (!args) {
    await ctx.reply(
      'Uso: /responder <codigo_oficio> <codigo_respuesta>\n' +
      'Ejemplo: /responder C4234-585-2024 C4221-123-2026'
    );
    return;
  }

  const parts = args.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply(
      'Debes indicar el codigo del oficio y el codigo de respuesta.\n' +
      'Ejemplo: /responder C4234-585-2024 C4221-123-2026'
    );
    return;
  }

  const codeOficio = parts[0];
  const codeRespuesta = parts[1];

  try {
    // Verificar que el oficio existe
    const found = await findEntryByCode(
      config.onedriveFolderPath,
      config.excelFileName,
      codeOficio
    );

    if (!found) {
      await ctx.reply(`No se encontro oficio con codigo: ${codeOficio}`);
      return;
    }

    if (found.entry.estado === 'Respondido') {
      await ctx.reply(
        `El oficio ${codeOficio} ya fue respondido.\n` +
        `Codigo de respuesta: ${found.entry.codeRespuesta}\n` +
        `Fecha: ${found.entry.fechaRespuesta}`
      );
      return;
    }

    const fechaRespuesta = new Date().toLocaleDateString('es-CO');

    // Actualizar Excel
    await ctx.reply('Actualizando estado en Excel...');
    await updateEntryStatus(
      config.onedriveFolderPath,
      config.excelFileName,
      codeOficio,
      'Respondido',
      fechaRespuesta,
      codeRespuesta
    );

    await ctx.reply(
      `Oficio actualizado:\n` +
      `Codigo: ${codeOficio}\n` +
      `Estado: Respondido\n` +
      `Codigo respuesta: ${codeRespuesta}\n` +
      `Fecha respuesta: ${fechaRespuesta}`
    );

    // Generar borrador de respuesta si hay datos en cache
    const cachedData = getCachedDocumentData(codeOficio);
    if (cachedData) {
      await generateAndSendDraft(ctx, config, cachedData, codeRespuesta);
    } else {
      await ctx.reply(
        'No se encontraron datos del documento en cache para generar borrador.\n' +
        'El borrador solo se genera si el documento fue procesado con /gestionar en esta sesion.'
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error(`Error al responder oficio: ${errorMessage}`);
    await ctx.reply(`Error: ${errorMessage}`);
  }
}

async function generateAndSendDraft(
  ctx: CommandContext<Context>,
  config: { onedriveFolderPath: string; excelFileName: string },
  docData: DocumentData,
  codeRespuesta: string
): Promise<void> {
  try {
    await ctx.reply('Generando borrador de respuesta...');

    const draftBuffer = generateDraftResponse(docData, codeRespuesta);
    const draftFileName = `Respuesta_${codeRespuesta}.docx`;

    // Subir borrador a OneDrive
    await ensureFolderExists(config.onedriveFolderPath);
    const draftUrl = await uploadFile(config.onedriveFolderPath, draftFileName, draftBuffer);

    // Enviar borrador al grupo
    await ctx.replyWithDocument(new InputFile(draftBuffer, draftFileName), {
      caption: `Borrador de respuesta: ${codeRespuesta}\nEnlace OneDrive: ${draftUrl}`,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error(`Error al generar borrador: ${errorMessage}`);
    await ctx.reply(`Error al generar borrador: ${errorMessage}`);
  }
}
