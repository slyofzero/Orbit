"use client";
import { useEffect, useState } from "react";
import { loadImage } from "@/lib/imageStore";

// A picture inside a question: img:name comes from the pictures saved with your pack, https:// links are loaded from the web.
export default function Img({ src, alt }: { src: string; alt: string }) {
  const stored = src.startsWith("img:");
  const [data, setData] = useState<string | null | undefined>(stored ? undefined : src);
  useEffect(() => {
    if (!stored) { setData(src); return; }
    let live = true;
    loadImage(src.slice(4)).then((d) => { if (live) setData(d ?? null); }).catch(() => { if (live) setData(null); });
    return () => { live = false; };
  }, [src, stored]);
  if (data === undefined) return <span className="q-img ph" aria-hidden>…</span>;
  if (data === null) return <span className="q-img ph">Picture missing: {alt || "image"}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="q-img" src={data} alt={alt} loading="lazy" decoding="async" />;
}
