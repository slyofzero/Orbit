"use client";
// Puts a stored picture on the clipboard (browsers only accept PNG there) or downloads it, so it can be pasted into an AI chat next to the prompt.

/** Any picture the app stores (png, jpeg, webp, gif, svg) as a PNG file. */
export async function toPng(dataUrl: string): Promise<Blob> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const w = img.naturalWidth || 800, h = img.naturalHeight || 600;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); // transparent pictures would paste as black
  g.drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read the picture."))), "image/png"));
}

export async function copyPicture(dataUrl: string): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": toPng(dataUrl) })]);
}

export async function downloadPicture(dataUrl: string, filename: string): Promise<void> {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await toPng(dataUrl));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
