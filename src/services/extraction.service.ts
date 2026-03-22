import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { DocumentData } from '../types/document.types';
import logger from '../utils/logger';

interface ExtractionPatterns {
  radicado: string[];
  fecha: string[];
  asunto: string[];
  solicitudes: string[];
  meses: Record<string, string>;
}

function loadPatterns(): ExtractionPatterns {
  const patternsPath = path.join(process.cwd(), 'config', 'extraction-patterns.json');
  const raw = fs.readFileSync(patternsPath, 'utf-8');
  return JSON.parse(raw) as ExtractionPatterns;
}

export async function extractFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

export async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') {
    return extractFromPdf(buffer);
  }
  if (extension === 'docx' || extension === 'doc') {
    return extractFromDocx(buffer);
  }

  throw new Error(`Formato no soportado: .${extension}`);
}

function extractRadicado(
  text: string,
  patterns: ExtractionPatterns
): { value: string | null; confidence: 'high' | 'medium' | 'none' } {
  for (let i = 0; i < patterns.radicado.length; i++) {
    const regex = new RegExp(patterns.radicado[i], 'im');
    const match = text.match(regex);
    if (match?.[1]) {
      const confidence = i === 0 ? 'high' : 'medium';
      logger.info(`Radicado encontrado (patron ${i}, confianza: ${confidence}): ${match[1].trim()}`);
      return { value: match[1].trim(), confidence };
    }
  }
  return { value: null, confidence: 'none' };
}

function extractFecha(
  text: string,
  patterns: ExtractionPatterns
): { value: string | null; confidence: 'high' | 'medium' | 'none' } {
  // Patron con nombre de ciudad + dia de mes de anio
  const cityPattern = new RegExp(patterns.fecha[0], 'im');
  const cityMatch = text.match(cityPattern);
  if (cityMatch) {
    const dia = cityMatch[1].padStart(2, '0');
    const mes = patterns.meses[cityMatch[2].toLowerCase()] || cityMatch[2];
    const anio = cityMatch[3];
    const fecha = `${dia}/${mes}/${anio}`;
    logger.info(`Fecha encontrada (ciudad, confianza: high): ${fecha}`);
    return { value: fecha, confidence: 'high' };
  }

  // Patron "Fecha: dia de mes de anio"
  const fechaTextPattern = new RegExp(patterns.fecha[1], 'im');
  const fechaTextMatch = text.match(fechaTextPattern);
  if (fechaTextMatch) {
    const dia = fechaTextMatch[1].padStart(2, '0');
    const mes = patterns.meses[fechaTextMatch[2].toLowerCase()] || fechaTextMatch[2];
    const anio = fechaTextMatch[3];
    const fecha = `${dia}/${mes}/${anio}`;
    logger.info(`Fecha encontrada (texto, confianza: medium): ${fecha}`);
    return { value: fecha, confidence: 'medium' };
  }

  // Patron "Fecha: dd/mm/yyyy"
  const fechaNumPattern = new RegExp(patterns.fecha[2], 'im');
  const fechaNumMatch = text.match(fechaNumPattern);
  if (fechaNumMatch) {
    const fecha = `${fechaNumMatch[1].padStart(2, '0')}/${fechaNumMatch[2].padStart(2, '0')}/${fechaNumMatch[3]}`;
    logger.info(`Fecha encontrada (numerica, confianza: medium): ${fecha}`);
    return { value: fecha, confidence: 'medium' };
  }

  return { value: null, confidence: 'none' };
}

function extractAsunto(
  text: string,
  patterns: ExtractionPatterns
): { value: string | null; confidence: 'high' | 'medium' | 'none' } {
  for (let i = 0; i < patterns.asunto.length; i++) {
    const regex = new RegExp(patterns.asunto[i], 'im');
    const match = text.match(regex);
    if (match?.[1] && match.index !== undefined) {
      const startPos = match.index + match[0].indexOf(match[1]);
      const remaining = text.substring(startPos);
      const endMatch = remaining.search(/\n\s*\n|\n\s*[Rr]espetado|\n\s*[Ee]n atenci[oó]n/);
      const fullAsunto = endMatch > 0
        ? remaining.substring(0, endMatch)
        : match[1];
      const cleaned = fullAsunto.replace(/\s+/g, ' ').trim().substring(0, 500);
      const confidence = i === 0 ? 'high' : 'medium';
      logger.info(`Asunto encontrado (confianza: ${confidence}): ${cleaned}`);
      return { value: cleaned, confidence };
    }
  }
  return { value: null, confidence: 'none' };
}

function extractSolicitudes(
  text: string,
  patterns: ExtractionPatterns
): string[] {
  const solicitudes: string[] = [];

  for (const pattern of patterns.solicitudes) {
    const regex = new RegExp(pattern, 'gim');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const solicitud = match[0].trim();
      if (solicitud.length > 20 && !solicitudes.includes(solicitud)) {
        solicitudes.push(solicitud);
      }
    }
  }

  logger.info(`Solicitudes encontradas: ${solicitudes.length}`);
  return solicitudes;
}

export async function extractDocumentData(
  buffer: Buffer,
  fileName: string,
  fechaRecepcion: Date
): Promise<DocumentData> {
  const rawText = await extractTextFromFile(buffer, fileName);
  const patterns = loadPatterns();

  const radicado = extractRadicado(rawText, patterns);
  const fecha = extractFecha(rawText, patterns);
  const asunto = extractAsunto(rawText, patterns);
  const solicitudes = extractSolicitudes(rawText, patterns);

  return {
    radicado: radicado.value,
    asunto: asunto.value,
    fechaDocumento: fecha.value,
    fechaRecepcion,
    solicitudes,
    confidence: {
      radicado: radicado.confidence,
      fecha: fecha.confidence,
      asunto: asunto.confidence,
    },
    rawText,
  };
}
