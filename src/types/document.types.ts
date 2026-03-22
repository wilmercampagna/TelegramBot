export interface DocumentData {
  radicado: string | null;
  asunto: string | null;
  fechaDocumento: string | null;
  fechaRecepcion: Date;
  solicitudes: string[];
  confidence: Record<string, 'high' | 'medium' | 'none'>;
  rawText: string;
}

export interface DownloadedFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface ExcelRow {
  code: string;
  asunto: string;
  fechaDocumento: string;
  fechaRecepcion: string;
  estado: string;
  fechaRespuesta: string;
  codeRespuesta: string;
}
