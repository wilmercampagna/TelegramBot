import { Bot, CommandContext, Context, InlineKeyboard } from 'grammy';
import { downloadTelegramFile } from '../../services/telegram.service';
import { extractDocumentData } from '../../services/extraction.service';
import { uploadFile, ensureFolderExists, fileExists } from '../../services/onedrive.service';
import { addTrackingEntry, entryExists } from '../../services/excel.service';
import { generateDraftResponse } from '../../services/docgen.service';
import { getGroupConfig } from '../../utils/config';
import { getTempFilePath } from '../../utils/helpers';
import { cacheDocumentData } from '../../utils/cache';
import { DocumentData } from '../../types/document.types';
import { GroupConfig } from '../../types/config.types';
import logger from '../../utils/logger';
import fs from 'fs';

// Datos pendientes de confirmacion: chatId -> datos del documento
const pendingConfirmations = new Map<number, PendingDocument>();

interface PendingDocument {
  fileName: string;
  buffer: Buffer;
  docData: DocumentData;
  groupConfig: GroupConfig;
}

export function registerGestionarCommand(bot: Bot): void {
  bot.command('gestionar', (ctx) => handleGestionar(ctx, bot));

  bot.callbackQuery('confirm_yes', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id || 0;
    const pending = pendingConfirmations.get(chatId);

    if (!pending) {
      await ctx.editMessageText('La sesion de confirmacion ha expirado. Usa /gestionar nuevamente.');
      return;
    }

    pendingConfirmations.delete(chatId);
    await processConfirmedDocument(ctx, pending);
  });

  bot.callbackQuery('confirm_cancel', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id || 0;
    pendingConfirmations.delete(chatId);
    await ctx.editMessageText('Gestion cancelada.');
  });
}

async function handleGestionar(ctx: CommandContext<Context>, bot: Bot): Promise<void> {
  const replyMessage = ctx.message?.reply_to_message;

  if (!replyMessage) {
    await ctx.reply(
      'Debes responder a un mensaje que contenga un documento.\n' +
      'Envia un documento y luego responde con /gestionar.'
    );
    return;
  }

  const document = replyMessage.document;
  if (!document) {
    await ctx.reply(
      'El mensaje al que respondes no contiene un documento.\n' +
      'Asegurate de responder a un mensaje con un archivo PDF o Word.'
    );
    return;
  }

  const fileName = document.file_name || `documento_${Date.now()}`;
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension !== 'pdf' && extension !== 'docx' && extension !== 'doc') {
    await ctx.reply('Formato no soportado. Solo se aceptan archivos PDF (.pdf) o Word (.docx).');
    return;
  }

  const groupConfig = getGroupConfig(ctx.chat?.id || 0);
  if (!groupConfig) {
    await ctx.reply('Este grupo no tiene configuracion de OneDrive. Contacta al administrador.');
    return;
  }

  await ctx.reply(`Procesando documento: ${fileName}...`);

  try {
    const downloadedFile = await downloadTelegramFile(bot, document.file_id, fileName);
    const tempPath = getTempFilePath(fileName);
    fs.writeFileSync(tempPath, downloadedFile.buffer);

    const fechaRecepcion = new Date(
      (replyMessage.date || ctx.message?.date || Date.now() / 1000) * 1000
    );

    await ctx.reply('Extrayendo informacion del documento...');
    const docData = await extractDocumentData(downloadedFile.buffer, fileName, fechaRecepcion);

    // Mostrar resumen y pedir confirmacion
    const summary = formatExtractionSummary(fileName, downloadedFile.buffer.length, docData);
    const keyboard = new InlineKeyboard()
      .text('Confirmar', 'confirm_yes')
      .text('Cancelar', 'confirm_cancel');

    const chatId = ctx.chat?.id || 0;
    pendingConfirmations.set(chatId, {
      fileName,
      buffer: downloadedFile.buffer,
      docData,
      groupConfig,
    });

    await ctx.reply(summary + '\n\nConfirmar gestion del documento?', {
      reply_markup: keyboard,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error(`Error al procesar documento: ${errorMessage}`);
    await ctx.reply(`Error al procesar el documento: ${errorMessage}`);
  }
}

async function processConfirmedDocument(
  ctx: { editMessageText: (text: string) => Promise<unknown>; reply: (text: string) => Promise<unknown> },
  pending: PendingDocument
): Promise<void> {
  const { fileName, buffer, docData, groupConfig } = pending;

  try {
    // Validar duplicado
    const alreadyExists = await fileExists(groupConfig.onedriveFolderPath, fileName);
    if (alreadyExists) {
      await ctx.reply(`El archivo "${fileName}" ya existe en OneDrive. No se subio nuevamente.`);
    } else {
      await ctx.reply('Subiendo documento a OneDrive...');
      await ensureFolderExists(groupConfig.onedriveFolderPath);
      const onedriveUrl = await uploadFile(groupConfig.onedriveFolderPath, fileName, buffer);
      await ctx.reply(`Documento subido a OneDrive.\nEnlace: ${onedriveUrl}`);
    }

    // Registrar en Excel
    const code = docData.radicado || fileName;

    const alreadyRegistered = await entryExists(
      groupConfig.onedriveFolderPath,
      groupConfig.excelFileName,
      code
    );

    if (alreadyRegistered) {
      await ctx.reply(`El oficio ${code} ya esta registrado en el Excel.`);
    } else {
      await ctx.reply('Registrando en Excel de seguimiento...');
      await addTrackingEntry(
        groupConfig.onedriveFolderPath,
        groupConfig.excelFileName,
        code,
        docData.asunto || 'Sin asunto detectado',
        docData.fechaDocumento || 'No detectada',
        docData.fechaRecepcion.toLocaleDateString('es-CO')
      );
      await ctx.reply(`Registro agregado al Excel con codigo: ${code}\nEstado: En Revision`);
    }

    // Cachear datos para uso posterior (borrador de respuesta)
    cacheDocumentData(code, docData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error(`Error al procesar documento confirmado: ${errorMessage}`);
    await ctx.reply(`Error: ${errorMessage}`);
  }
}

function confidenceIcon(level: string): string {
  if (level === 'high') return '[OK]';
  if (level === 'medium') return '[?]';
  return '[X]';
}

function formatExtractionSummary(
  fileName: string,
  fileSize: number,
  data: DocumentData
): string {
  const lines: string[] = [
    `Documento: ${fileName}`,
    `Tamano: ${(fileSize / 1024).toFixed(1)} KB`,
    `Fecha de recepcion: ${data.fechaRecepcion.toLocaleDateString('es-CO')}`,
    '',
    '--- Datos extraidos ---',
    `${confidenceIcon(data.confidence.radicado)} Radicado: ${data.radicado || 'No detectado'}`,
    `${confidenceIcon(data.confidence.asunto)} Asunto: ${data.asunto || 'No detectado'}`,
    `${confidenceIcon(data.confidence.fecha)} Fecha del documento: ${data.fechaDocumento || 'No detectada'}`,
  ];

  if (data.solicitudes.length > 0) {
    lines.push('', `Solicitudes encontradas (${data.solicitudes.length}):`);
    data.solicitudes.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.substring(0, 150)}`);
    });
  }

  lines.push('', 'Leyenda: [OK] Alta confianza | [?] Media | [X] No detectado');
  return lines.join('\n');
}
