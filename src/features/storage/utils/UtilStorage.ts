/** Object key extensions come from the (allowlisted) MIME type only [BUG-03]. */
const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const storageExtensionFor = (mimeType: string): string =>
  EXTENSIONS[mimeType] ?? "bin";
