"use client";
// The rendered text of an editor, with a size slider on its pictures: hover a picture (or tap it) and drag the
// slider on its top-left corner. The size is written back into the text (lib/images.ts setPictureSize), so the text
// stays the one truth. A picture grows and shrinks from that corner, so the slider never has to move. The slider
// fades in and out: once shown it stays mounted (just faded out and inert), so leaving can play the fade.

import { useRef, useState, type MouseEvent } from "react";
import { Rich } from "@/components/ui/Rich";
import { Slider } from "@/components/ui/Slider";
import { cx } from "@/components/utils/cx";
import { pictureSizes, setPictureSize } from "@/lib/images";

type Picked = { index: number; top: number; left: number };

export function PicturePreview({
  text,
  onChange,
  className,
}: {
  text: string;
  /** receives the text with the new size; leave out and the pictures get no slider */
  onChange?: (text: string) => void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null); // where the slider is (kept while it fades out)
  const [shown, setShown] = useState(false);

  /** The picture under the pointer (Rich marks each with data-picture; their order is the text's order). */
  const pick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-picture]");
    const index = el && box.current ? [...box.current.querySelectorAll("[data-picture]")].indexOf(el) : -1;
    // offsetTop / offsetLeft are measured from this box, which is `relative`
    if (!el || index < 0) return false;
    setPicked((p) => (p?.index === index ? p : { index, top: el.offsetTop + 8, left: el.offsetLeft + 8 }));
    setShown(true);
    return true;
  };
  const inside = (node: EventTarget | null) =>
    node instanceof Element && (!!bar.current?.contains(node) || !!node.closest("[data-picture]"));

  if (!onChange) return <Rich text={text} block className={className} />;
  return (
    <div
      ref={box}
      className={`relative ${className ?? ""}`}
      onMouseOver={pick}
      onMouseOut={(e) => !inside(e.relatedTarget) && setShown(false)}
      onClick={(e) => !pick(e) && !inside(e.target) && setShown(false)} // a touch screen has no hover
    >
      <Rich text={text} block />
      {picked && (
        <div
          ref={bar}
          inert={!shown}
          className={cx(
            "absolute z-10 w-[220px] max-w-[90%] rounded-md border border-line bg-sheet px-3 py-2 shadow-lg",
            "transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none",
            !shown && "pointer-events-none opacity-0",
          )}
          style={{ top: picked.top, left: picked.left }}
        >
          <Slider
            label="Picture size"
            value={pictureSizes(text)[picked.index] ?? 100}
            min={10}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => onChange(setPictureSize(text, picked.index, v))}
          />
        </div>
      )}
    </div>
  );
}
