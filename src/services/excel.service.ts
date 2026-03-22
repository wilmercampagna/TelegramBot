import { getGraphClient } from '../auth/graph-auth';
import { ExcelRow } from '../types/document.types';
import logger from '../utils/logger';

async function getFileItemId(folderPath: string, fileName: string): Promise<string> {
  const client = getGraphClient();
  const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
  const fullPath = `/${cleanPath}/${fileName}`;

  const item = await client.api(`/me/drive/root:${fullPath}`).get();
  return item.id as string;
}

export async function addTrackingEntry(
  folderPath: string,
  excelFileName: string,
  code: string,
  asunto: string,
  fechaDocumento: string,
  fechaRecepcion: string
): Promise<void> {
  const client = getGraphClient();
  const itemId = await getFileItemId(folderPath, excelFileName);

  const rowValues = [[
    code,
    asunto,
    fechaDocumento,
    fechaRecepcion,
    'En Revision',  // Estado
    '',             // FechaRespuesta
    '',             // CodeRespuesta
  ]];

  await client
    .api(`/me/drive/items/${itemId}/workbook/tables/Radicados/rows/add`)
    .post({ values: rowValues });

  logger.info(`Registro agregado al Excel: ${code}`);
}

export async function getAllEntries(
  folderPath: string,
  excelFileName: string
): Promise<ExcelRow[]> {
  const client = getGraphClient();
  const itemId = await getFileItemId(folderPath, excelFileName);

  const result = await client
    .api(`/me/drive/items/${itemId}/workbook/tables/Radicados/rows`)
    .get();

  const rows = result.value as Array<{ values: string[][] }>;
  return rows.map((row) => ({
    code: row.values[0][0] || '',
    asunto: row.values[0][1] || '',
    fechaDocumento: row.values[0][2] || '',
    fechaRecepcion: row.values[0][3] || '',
    estado: row.values[0][4] || '',
    fechaRespuesta: row.values[0][5] || '',
    codeRespuesta: row.values[0][6] || '',
  }));
}

export async function getEntriesEnRevision(
  folderPath: string,
  excelFileName: string
): Promise<ExcelRow[]> {
  const entries = await getAllEntries(folderPath, excelFileName);
  return entries.filter((e) => e.estado === 'En Revision');
}

export async function getEntriesRespondidos(
  folderPath: string,
  excelFileName: string
): Promise<ExcelRow[]> {
  const entries = await getAllEntries(folderPath, excelFileName);
  return entries.filter((e) => e.estado === 'Respondido');
}

export async function entryExists(
  folderPath: string,
  excelFileName: string,
  code: string
): Promise<boolean> {
  const entries = await getAllEntries(folderPath, excelFileName);
  return entries.some((e) => e.code === code);
}

export async function findEntryByCode(
  folderPath: string,
  excelFileName: string,
  code: string
): Promise<{ entry: ExcelRow; rowIndex: number } | null> {
  const entries = await getAllEntries(folderPath, excelFileName);
  const index = entries.findIndex((e) => e.code === code);
  if (index === -1) return null;
  return { entry: entries[index], rowIndex: index };
}

export async function updateEntryStatus(
  folderPath: string,
  excelFileName: string,
  code: string,
  estado: string,
  fechaRespuesta: string,
  codeRespuesta: string
): Promise<void> {
  const client = getGraphClient();
  const itemId = await getFileItemId(folderPath, excelFileName);

  const found = await findEntryByCode(folderPath, excelFileName, code);
  if (!found) {
    throw new Error(`No se encontro el oficio con codigo: ${code}`);
  }

  const range = await client
    .api(`/me/drive/items/${itemId}/workbook/tables/Radicados/rows/itemAt(index=${found.rowIndex})/range`)
    .get();

  const currentValues = range.values[0] as string[];
  currentValues[4] = estado;
  currentValues[5] = fechaRespuesta;
  currentValues[6] = codeRespuesta;

  await client
    .api(`/me/drive/items/${itemId}/workbook/tables/Radicados/rows/itemAt(index=${found.rowIndex})/range`)
    .patch({ values: [currentValues] });

  logger.info(`Oficio ${code} actualizado: estado=${estado}, respuesta=${codeRespuesta}`);
}

export async function generateResponseCode(
  folderPath: string,
  excelFileName: string
): Promise<string> {
  const entries = await getAllEntries(folderPath, excelFileName);
  const year = new Date().getFullYear();
  const prefix = `JCP-`;

  const existingNumbers = entries
    .map((e) => e.codeRespuesta)
    .filter((code) => code.startsWith(prefix))
    .map((code) => {
      const match = code.match(/^JCP-(\d+)-/);
      return match ? parseInt(match[1], 10) : 0;
    });

  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = (maxNumber + 1).toString().padStart(3, '0');

  return `JCP-${nextNumber}-${year}`;
}

export async function searchEntries(
  folderPath: string,
  excelFileName: string,
  query: string
): Promise<ExcelRow[]> {
  const entries = await getAllEntries(folderPath, excelFileName);
  const lowerQuery = query.toLowerCase();
  return entries.filter(
    (e) =>
      e.code.toLowerCase().includes(lowerQuery) ||
      e.asunto.toLowerCase().includes(lowerQuery)
  );
}
