"use client";
// What every import screen shows when a plan, question or progress file is refused: the exact problems, in a
// numbered list, and a button that copies how to fix the file (lib/importFix.ts). The text works pasted into
// any AI chat or read by hand. Nothing is imported while this is on screen.

import { Callout } from "@/components/ui/Callout";
import { CopyButton } from "@/components/ui/CopyButton";
import { Text } from "@/components/ui/Text";
import { fixInstructions, IMPORT_KIND, type ImportKind } from "@/lib/importFix";

/** `fileName`: shown in the title when several files are checked together. */
export function ImportProblems({ kind, errors, fileName }: { kind: ImportKind; errors: string[]; fileName?: string }) {
  const { noun } = IMPORT_KIND[kind];
  return (
    <Callout
      tone="warn"
      title={`${fileName ?? `This ${noun}`} can't be imported yet: ${errors.length} problem${errors.length === 1 ? "" : "s"}`}
    >
      <ol className="m-0 grid gap-1 pl-5">
        {errors.map((e) => (
          <li key={e}>
            <Text as="span">{e}</Text>
          </li>
        ))}
      </ol>
      <Text variant="hint" block className="mt-3">
        {kind === "backup"
          ? "Nothing was changed. Use a file saved by Export progress."
          : "Nothing was imported. Paste it into AI chat to fix."}
      </Text>
      <div className="mt-2 flex">
        <CopyButton
          text={() => fixInstructions(kind, errors)}
          label="Copy how to fix this"
          copiedLabel="Copied. Paste it into your AI chat"
        />
      </div>
    </Callout>
  );
}
