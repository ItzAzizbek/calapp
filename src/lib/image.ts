export interface PreparedImage {
  /** Base64 JPEG (no data: prefix) sized for analysis. */
  analysis: string;
  /** Small JPEG data URL for storage and display. */
  thumbnail: string;
}

export class ImageError extends Error {}

// Vision models downscale large images anyway (GPT-4o to 768px on the
// short side), so there's no point uploading more.
const ANALYSIS_EDGE = 1568;
const THUMB_EDGE = 720;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // Respects EXIF orientation by default in modern browsers.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img>, which some browsers decode more formats with */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  quality: number,
): string {
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height =
    "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("Your browser couldn't process this image.");
  // JPEG has no alpha; paint white so transparent PNGs don't turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new ImageError("That file isn't an image.");
  }
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    const heic = /hei[cf]/i.test(file.type);
    throw new ImageError(
      heic
        ? "HEIC photos aren't supported in this browser. Export as JPEG and try again."
        : "We couldn't open this image. Try a JPEG or PNG.",
    );
  }
  try {
    const analysis = render(source, ANALYSIS_EDGE, 0.86);
    const thumbnail = render(source, THUMB_EDGE, 0.8);
    return { analysis: analysis.slice(analysis.indexOf(",") + 1), thumbnail };
  } finally {
    if ("close" in source) source.close();
  }
}

/** Base64 payload of a data URL, for re-analyzing a stored thumbnail. */
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
