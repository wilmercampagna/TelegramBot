import { DocumentData } from '../types/document.types';

// Cache temporal en memoria para datos extraidos de documentos
// Se usa entre /gestionar (extraccion) y la generacion de borrador
const documentCache = new Map<string, DocumentData>();

export function cacheDocumentData(code: string, data: DocumentData): void {
  documentCache.set(code, data);
}

export function getCachedDocumentData(code: string): DocumentData | undefined {
  return documentCache.get(code);
}

export function removeCachedDocumentData(code: string): void {
  documentCache.delete(code);
}
