"use client";
import { createContext, useContext, type ReactNode } from "react";

/** Turns a picture name (the <hash> in img:<hash>) into a URL the browser can show, or undefined if unknown.
 *  The app will provide one backed by the database; /dev provides an in-memory one. */
export type ImageResolver = (hash: string) => string | undefined;

const Ctx = createContext<ImageResolver>(() => undefined);

export function ImageProvider({ resolve, children }: { resolve: ImageResolver; children: ReactNode }) {
  return <Ctx.Provider value={resolve}>{children}</Ctx.Provider>;
}

export const useImageResolver = () => useContext(Ctx);
