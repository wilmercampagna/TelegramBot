import { Bot, CommandContext, Context } from 'grammy';
import { updateEntryStatus, findEntryByCode, generateResponseCode } from '../../services/excel.service';
import { generateDraftResponse } from '../../services/docgen.service';
import { uploadFile, ensureFolderExists, downloadFile, findFileByCode } from '../../services/onedrive.service';
import { extractDocumentData } from '../../services/extraction.service';
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

  const codeOficio = ctx.match?.toString().trim();
  if (!codeOficio) {
    await ctx.reply(
      'Uso: /responder <codigo_oficio>\n' +
      'Ejemplo: /responder C4234-585-2024\n\n' +
      'El codigo de respuesta (JCP-XXX-2026) se genera automaticamente.'
    );
    return;
  }

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

    // Generar codigo de respuesta automaticamente
    const codeRespuesta = await generateResponseCode(
      config.onedriveFolderPath,
      config.excelFileName
    );

    // Actualizar Excel
    await ctx.reply(`Codigo de respuesta generado: ${codeRespuesta}\nActualizando Excel...`);
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

    // Obtener datos del documento: cache o re-extraer desde OneDrive
    let docData = getCachedDocumentData(codeOficio);

    if (!docData) {
      await ctx.reply('Datos no encontrados en cache. Descargando documento de OneDrive...');
      const fileName = await findFileByCode(config.onedriveFolderPath, codeOficio);
      if (!fileName) {
        await ctx.reply('No se encontro el archivo del oficio en OneDrive. No se puede generar borrador.');
        return;
      }

      const fileBuffer = await downloadFile(config.onedriveFolderPath, fileName);
      docData = await extractDocumentData(
        fileBuffer,
        fileName,
        new Date(found.entry.fechaRecepcion)
      );
    }

    await generateAndSendDraft(ctx, config, docData, codeRespuesta);

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
