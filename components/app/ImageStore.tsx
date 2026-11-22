"use client";
// Gives every app screen its pictures: `img:<hash>` in any text is looked up in the database (`image.get`) the
// first time it is shown, turned into a blob URL and kept, and the screen shows it as soon as it arrives.
// It also gives the editor `addImage` (RichEditor's `onAddImage`): saves a picked or pasted file (`image.add`).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ImageProvider } from "@/components/utils";
import { dbCall } from "@/lib/db/client";
import { hashImage, imageRef } from "@/lib/images";

type AddImage = (file: File) => Promise<string>;
const AddCtx = createContext<AddImage | undefined>(undefined);

/** The editor's `onAddImage`: stores the file and returns `img:<hash>`. Undefined outside the app. */
export const useAddImage = () => useContext(AddCtx);

/** Width and height of a picture file, or null when the browser can't read them (e.g. some SVGs). */
async function sizeOf(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return null;
  }
}

export function ImageStore({ children }: { children: ReactNode }) {
  const urls = useRef(new Map<string, string>());
  const asked = useRef(new Set<string>());
  const [, bump] = useState(0);

  useEffect(() => {
    const map = urls.current;
    return () => map.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const resolve = useCallback((hash: string) => {
    const known = urls.current.get(hash);
    if (known || asked.current.has(hash)) return known;
    asked.current.add(hash);
    dbCall("image.get", { hash })
      .then((row) => {
        if (!row) return asked.current.delete(hash); // not stored (yet): ask again next time
        urls.current.set(
          hash,
          URL.createObjectURL(new Blob([row.bytes as Uint8Array<ArrayBuffer>], { type: row.mime })),
        );
        bump((n) => n + 1);
      })
      .catch(() => asked.current.delete(hash));
    return undefined;
  }, []);

  const add = useCallback<AddImage>(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await hashImage(bytes);
    const r = await dbCall("image.add", { hash, bytes, mime: file.type, ...(await sizeOf(file)) });
    if (!r.ok) throw new Error(r.error);
    if (!urls.current.has(hash)) urls.current.set(hash, URL.createObjectURL(file));
    bump((n) => n + 1);
    return imageRef(hash);
  }, []);

  return (
    <ImageProvider resolve={resolve}>
      <AddCtx.Provider value={add}>{children}</AddCtx.Provider>
    </ImageProvider>
  );
}
