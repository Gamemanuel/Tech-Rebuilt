export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export const ASPECT_PRESETS = {
  square: { label: "Square 1:1", value: 1 },
  landscape43: { label: "Landscape 4:3", value: 4 / 3 },
  portrait34: { label: "Portrait 3:4", value: 3 / 4 },
  widescreen: { label: "Widescreen 16:9", value: 16 / 9 },
  portrait916: { label: "Portrait 9:16", value: 9 / 16 },
} as const;

export type AspectKey = keyof typeof ASPECT_PRESETS;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Computes a centered crop rectangle (in natural pixel coordinates) that
 * matches the requested aspect ratio, filling as much of the source image
 * as possible.
 */
export function getCenteredCrop(
  naturalWidth: number,
  naturalHeight: number,
  targetAspect: number
): PixelCrop {
  const sourceAspect = naturalWidth / naturalHeight;
  let width: number;
  let height: number;

  if (sourceAspect > targetAspect) {
    height = naturalHeight;
    width = height * targetAspect;
  } else {
    width = naturalWidth;
    height = width / targetAspect;
  }

  return {
    x: (naturalWidth - width) / 2,
    y: (naturalHeight - height) / 2,
    width,
    height,
  };
}

export async function cropImageToBlob(
  src: string,
  crop: PixelCrop,
  format: OutputFormat,
  quality: number
): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode image"));
      },
      format,
      format === "image/png" ? undefined : quality
    );
  });
}

export function extensionForFormat(format: OutputFormat): string {
  switch (format) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}

export function stripExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? filename : filename.slice(0, idx);
}
