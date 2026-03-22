import { Bot } from 'grammy';
import { getEntriesEnRevision } from './excel.service';
import { AppConfig } from '../types/config.types';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

const DEFAULT_DAYS_LIMIT = 5;
let intervalId: ReturnType<typeof setInterval> | null = null;

export function startNotificationScheduler(bot: Bot): void {
  const checkIntervalMs = getCheckIntervalMs();
  const daysLimit = getDaysLimit();

  logger.info(`Notificaciones programadas: cada ${checkIntervalMs / 3600000}h, limite ${daysLimit} dias`);

  // Primera verificacion a los 30 segundos de arrancar
  setTimeout(() => checkOverdueDocuments(bot), 30_000);

  intervalId = setInterval(() => checkOverdueDocuments(bot), checkIntervalMs);
}

export function stopNotificationScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function checkOverdueDocuments(bot: Bot): Promise<void> {
  const config = loadGroupsConfig();
  const daysLimit = getDaysLimit();

  for (const group of config.groups) {
    try {
      const entries = await getEntriesEnRevision(group.onedriveFolderPath, group.excelFileName);
      const overdue = entries.filter((e) => {
        const recepcion = parseDate(e.fechaRecepcion);
        if (!recepcion) return false;
        const diffDays = daysBetween(recepcion, new Date());
        return diffDays >= daysLimit;
      });

      if (overdue.length === 0) continue;

      const lines = [`Oficios con mas de ${daysLimit} dias sin respuesta:\n`];
      overdue.forEach((e) => {
        const recepcion = parseDate(e.fechaRecepcion);
        const dias = recepcion ? daysBetween(recepcion, new Date()) : '?';
        lines.push(`- ${e.code} (${dias} dias)`);
        lines.push(`  Asunto: ${e.asunto.substring(0, 60)}`);
      });

      await bot.api.sendMessage(group.chatId, lines.join('\n'));
      logger.info(`Alerta enviada a ${group.name}: ${overdue.length} oficios vencidos`);

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      logger.error(`Error al verificar vencimientos en ${group.name}: ${msg}`);
    }
  }
}

function loadGroupsConfig(): AppConfig {
  const configPath = path.join(process.cwd(), 'config', 'groups.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as AppConfig;
}

function parseDate(dateStr: string): Date | null {
  // Formato esperado: d/m/yyyy (es-CO)
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

function getCheckIntervalMs(): number {
  const hours = parseInt(process.env.NOTIFICATION_INTERVAL_HOURS || '12', 10);
  return hours * 3_600_000;
}

function getDaysLimit(): number {
  return parseInt(process.env.NOTIFICATION_DAYS_LIMIT || String(DEFAULT_DAYS_LIMIT), 10);
}
