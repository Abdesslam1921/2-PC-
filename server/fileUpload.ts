// Minimal, dependency-free multipart/form-data parser used by the WhatsApp
// media upload routes. It streams the raw request into memory and splits it on
// the form boundary so we never depend on formidable/busboy being installed.

import { storagePut } from "./storage";
import type { IncomingMessage } from "http";

export interface UploadedFile {
  buffer?: Buffer;
  filepath?: string;
  originalFilename: string;
  mimetype: string;
  size: number;
}

export interface ParsedForm {
  fields: Record<string, string>;
  files: Record<string, UploadedFile>;
}

interface ParsedPart {
  headers: Record<string, string>;
  contentDisposition: Record<string, string>;
  data: Buffer;
}

function extractBoundary(contentType: string | undefined): string | null {
  if (!contentType) return null;
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  return boundary ? boundary.trim() : null;
}

function collectBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", chunk => {
      if (Buffer.isBuffer(chunk)) chunks.push(chunk);
      else chunks.push(Buffer.from(chunk));
    });
    request.on("error", reject);
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function parseDispositionHeader(
  raw: string
): { params: Record<string, string>; value: string } {
  const params: Record<string, string> = {};
  const parts = raw.split(";").map(part => part.trim());
  const value = parts.shift() ?? "";
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const rawValue = part.slice(eq + 1).trim();
    const cleaned = rawValue.replace(/^"|"$/g, "");
    if (key) params[key] = cleaned;
  }
  return { params, value };
}

function parseHeaders(headerText: string): ParsedPart["headers"] {
  const headers: Record<string, string> = {};
  const lines = headerText.split(/\r\n/);
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

function splitParts(body: Buffer, boundary: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  const delimiter = Buffer.from(`--${boundary}`);
  let index = body.indexOf(delimiter);
  while (index !== -1) {
    let cursor = index + delimiter.length;
    // Closing delimiter "--boundary--"
    if (body[cursor] === 0x2d && body[cursor + 1] === 0x2d) break;
    // Expect CRLF right after "--boundary"
    if (!(body[cursor] === 0x0d && body[cursor + 1] === 0x0a)) {
      index = body.indexOf(delimiter, cursor);
      continue;
    }
    cursor += 2;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) break;
    const headerText = body.subarray(cursor, headerEnd).toString("utf8");
    cursor = headerEnd + 4;
    const next = body.indexOf(delimiter, cursor);
    if (next === -1) break;
    let dataEnd = next;
    // Strip the trailing CRLF that precedes the next boundary marker
    if (dataEnd - 2 >= cursor && body[dataEnd - 2] === 0x0d && body[dataEnd - 1] === 0x0a) {
      dataEnd -= 2;
    }
    const data = body.subarray(cursor, dataEnd);
    const headers = parseHeaders(headerText);
    const disposition = parseDispositionHeader(
      headers["content-disposition"] ?? ""
    );
    parts.push({ headers, contentDisposition: disposition.params, data });
    index = next;
  }
  return parts;
}

export async function parseFormData(request: IncomingMessage): Promise<ParsedForm> {
  const boundary = extractBoundary(request.headers["content-type"]);
  if (!boundary)
    throw new Error(
      "تعذر قراءة الملف: ترويسة Content-Type لا تحتوي على boundary صالح."
    );
  const body = await collectBody(request);
  const fields: Record<string, string> = {};
  const files: Record<string, UploadedFile> = {};
  for (const part of splitParts(body, boundary)) {
    const name = part.contentDisposition.name ?? "";
    if (!name) continue;
    if (part.contentDisposition.filename !== undefined) {
      files[name] = {
        buffer: part.data,
        originalFilename: part.contentDisposition.filename,
        mimetype: part.headers["content-type"] ?? "application/octet-stream",
        size: part.data.length,
      };
    } else {
      fields[name] = part.data.toString("utf8").replace(/\r?\n$/, "");
    }
  }
  return { fields, files };
}

/**
 * Upload a file to the storage system. Supports both in-memory buffers
 * (from parseFormData) and on-disk file paths.
 */
export async function uploadFileToStorage(
  file: UploadedFile,
  userId: number,
  storeId: number,
  orderId: number
): Promise<{ url: string; storageKey: string }> {
  let fileBuffer: Buffer;
  if (file.buffer) {
    fileBuffer = file.buffer;
  } else if (file.filepath) {
    const { promises: fsPromises } = await import("fs");
    fileBuffer = await fsPromises.readFile(file.filepath);
  } else {
    throw new Error("الملف المرفوع لا يحتوي على بيانات قابلة للقراءة.");
  }

  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.originalFilename || "");
  const extension = extMatch ? extMatch[0].toLowerCase() : "";

  const storageKey = `whatsapp-media/${storeId}/order-${orderId}/${Date.now()}_${userId}${extension}`;
  const result = await storagePut(storageKey, fileBuffer, file.mimetype);

  return {
    url: result.url,
    storageKey: result.key,
  };
}
