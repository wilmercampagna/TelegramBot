import { Bot } from 'grammy';
import { DownloadedFile } from '../types/document.types';
import logger from '../utils/logger';

export async function downloadTelegramFile(
  bot: Bot,
  fileId: string,
  fileName: string
): Promise<DownloadedFile> {
  const file = await bot.api.getFile(fileId);
  const filePath = file.file_path;

  if (!filePath) {
    throw new Error('No se pudo obtener la ruta del archivo en Telegram');
  }

  const url = `https://api.telegram.org/file/bot${bot.token}/${filePath}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error al descargar archivo: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const mimeType = response.headers.get('content-type') || 'application/octet-stream';

  logger.info(`Archivo descargado: ${fileName} (${buffer.length} bytes)`);

  return { buffer, fileName, mimeType };
}
