import path from 'path';
import fs from 'fs';

const TEMP_DIR = path.join(process.cwd(), 'temp');

export function ensureTempDir(): string {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

export function getTempFilePath(fileName: string): string {
  return path.join(ensureTempDir(), fileName);
}

export function formatDateColombia(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
