import fs from 'fs';
import path from 'path';
import { AppConfig, GroupConfig } from '../types/config.types';
import logger from './logger';

let appConfig: AppConfig | null = null;

function loadConfig(): AppConfig {
  if (appConfig) return appConfig;

  const configPath = path.join(process.cwd(), 'config', 'groups.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  appConfig = JSON.parse(raw) as AppConfig;

  logger.info(`Configuracion cargada: ${appConfig.groups.length} grupo(s)`);
  return appConfig;
}

export function getGroupConfig(chatId: number): GroupConfig | undefined {
  const config = loadConfig();
  return config.groups.find((g) => g.chatId === chatId);
}

export function getDefaultFolderPath(): string {
  return process.env.ONEDRIVE_DEFAULT_FOLDER || 'TelegramBot/Documentos';
}

export function reloadConfig(): void {
  appConfig = null;
  loadConfig();
}
