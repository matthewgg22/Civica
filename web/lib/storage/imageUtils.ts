const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.8;

/**
 * Downscales an image File to MAX_DIMENSION on its longest side, re-encodes
 * as JPEG. Non-image files are returned unchanged.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { width, height } = img;
      const longestSide = Math.max(width, height);

      if (longestSide <= MAX_DIMENSION) {
        // Already small enough — still re-encode to strip EXIF if JPEG
        if (file.type === "image/jpeg") {
          renderAndResolve(img, width, height, file.name, resolve, reject);
        } else {
          resolve(file);
        }
        return;
      }

      const scale = MAX_DIMENSION / longestSide;
      renderAndResolve(img, Math.round(width * scale), Math.round(height * scale), file.name, resolve, reject);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

function renderAndResolve(
  img: HTMLImageElement,
  w: number,
  h: number,
  originalName: string,
  resolve: (f: File) => void,
  reject: (e: Error) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    reject(new Error("Canvas not available"));
    return;
  }
  ctx.drawImage(img, 0, 0, w, h);
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob failed"));
        return;
      }
      const name = originalName.replace(/\.[^.]+$/, ".jpg");
      resolve(new File([blob], name, { type: "image/jpeg" }));
    },
    "image/jpeg",
    JPEG_QUALITY
  );
}
