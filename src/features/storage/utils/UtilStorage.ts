import type { IStoredObject } from "@/infrastructure/storage/interfaces/IProvider";

/** Object key extensions come from the (allowlisted) MIME type only [BUG-03]. */
const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const storageExtensionFor = (mimeType: string): string =>
  EXTENSIONS[mimeType] ?? "bin";

/**
 * A streaming response for a stored object with Content-Type,
 * Content-Disposition and, when known, Content-Length and ETag; nothing is
 * buffered [BUG-18].
 */
export const storageFileResponse = (
  object: IStoredObject,
  metadata: { mimeType: string; name: string },
  disposition: "inline" | "attachment",
): Response => {
  const headers = new Headers({
    "Content-Type": metadata.mimeType,
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
  });
  if (object.contentLength !== undefined) {
    headers.set("Content-Length", String(object.contentLength));
  }
  if (object.etag) {
    headers.set("ETag", object.etag);
  }
  return new Response(object.stream, { headers });
};
