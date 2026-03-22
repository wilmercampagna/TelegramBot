import { getGraphClient } from '../auth/graph-auth';
import logger from '../utils/logger';

const MAX_SIMPLE_UPLOAD = 4 * 1024 * 1024; // 4 MB

export async function fileExists(
  folderPath: string,
  fileName: string
): Promise<boolean> {
  const client = getGraphClient();
  const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
  const fullPath = `/${cleanPath}/${fileName}`;

  try {
    await client.api(`/me/drive/root:${fullPath}`).get();
    return true;
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number };
    if (graphError.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

export async function uploadFile(
  folderPath: string,
  fileName: string,
  content: Buffer
): Promise<string> {
  const client = getGraphClient();
  const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
  const fullPath = `/${cleanPath}/${fileName}`;

  if (content.length <= MAX_SIMPLE_UPLOAD) {
    return simpleUpload(fullPath, content);
  }
  return sessionUpload(fullPath, content);
}

async function simpleUpload(filePath: string, content: Buffer): Promise<string> {
  const client = getGraphClient();

  const result = await client
    .api(`/me/drive/root:${filePath}:/content`)
    .put(content);

  logger.info(`Archivo subido a OneDrive: ${filePath}`);
  return result.webUrl || '';
}

async function sessionUpload(filePath: string, content: Buffer): Promise<string> {
  const client = getGraphClient();

  const session = await client
    .api(`/me/drive/root:${filePath}:/createUploadSession`)
    .post({ item: { '@microsoft.graph.conflictBehavior': 'rename' } });

  const uploadUrl = session.uploadUrl as string;
  const fileSize = content.length;
  const chunkSize = 3_276_800; // ~3.1 MB (multiple de 320 KB)

  let offset = 0;
  let result: Record<string, string> = {};

  while (offset < fileSize) {
    const end = Math.min(offset + chunkSize, fileSize);
    const chunk = content.subarray(offset, end);

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': chunk.length.toString(),
        'Content-Range': `bytes ${offset}-${end - 1}/${fileSize}`,
      },
      body: chunk,
    });

    if (!response.ok) {
      throw new Error(`Error al subir fragmento: ${response.statusText}`);
    }

    result = await response.json() as Record<string, string>;
    offset = end;
  }

  logger.info(`Archivo grande subido a OneDrive: ${filePath}`);
  return result.webUrl || '';
}

export async function ensureFolderExists(folderPath: string): Promise<void> {
  const client = getGraphClient();
  const parts = folderPath.replace(/^\/+|\/+$/g, '').split('/');

  let currentPath = '';
  for (const part of parts) {
    const parentPath = currentPath || '/me/drive/root';
    const apiPath = currentPath
      ? `/me/drive/root:/${currentPath}:/children`
      : '/me/drive/root/children';

    try {
      await client.api(apiPath).post({
        name: part,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });
      logger.info(`Carpeta creada: ${currentPath}/${part}`);
    } catch (error: unknown) {
      const graphError = error as { statusCode?: number };
      if (graphError.statusCode === 409) {
        // La carpeta ya existe
      } else {
        throw error;
      }
    }

    currentPath = currentPath ? `${currentPath}/${part}` : part;
  }
}
