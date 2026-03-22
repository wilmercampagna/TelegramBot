import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import { DocumentData } from '../types/document.types';
import logger from '../utils/logger';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'respuesta-template.docx');

export function generateDraftResponse(
  docData: DocumentData,
  codeRespuesta: string
): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('Plantilla de respuesta no encontrada en templates/respuesta-template.docx');
  }

  const templateContent = fs.readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const today = new Date();
  const solicitudesText = docData.solicitudes.length > 0
    ? docData.solicitudes.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '[NO SE DETECTARON SOLICITUDES - COMPLETAR MANUALMENTE]';

  doc.render({
    code_respuesta: codeRespuesta,
    radicado: docData.radicado || '[RADICADO NO DETECTADO]',
    asunto: docData.asunto || '[ASUNTO NO DETECTADO]',
    fecha_documento: docData.fechaDocumento || '[FECHA NO DETECTADA]',
    fecha_respuesta: today.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    fecha_recepcion: docData.fechaRecepcion.toLocaleDateString('es-CO'),
    solicitudes: solicitudesText,
    num_solicitudes: docData.solicitudes.length,
  });

  const buffer = doc.getZip().generate({ type: 'nodebuffer' });
  logger.info(`Borrador de respuesta generado: ${codeRespuesta}`);
  return buffer;
}
