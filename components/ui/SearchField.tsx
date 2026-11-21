"use client";
import { IconSearch, IconX } from "@/components/icons";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/utils/cx";

/** A pill-shaped search box for a toolbar ("Find a topic"), with a search icon and a clear button once
 *  something is typed. `label` is what screen readers say; `placeholder` is plain text (an attribute can't
 *  show maths). It grows to fill the row, up to 340px; `className` can change that. */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cx("relative max-w-[340px] min-w-[200px] flex-1", className)}>
      <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray" />
      <input
        type="search"
        value={value}
        placeholder={placeholder ?? label}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border-[1.5px] border-line bg-sheet py-[9px] pr-10 pl-10 font-body text-[0.95rem] text-ink transition-[border-color,box-shadow] duration-150 hover:border-gray focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <IconButton
          label="Clear search"
          size="sm"
          variant="ghost"
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          onClick={() => onChange("")}
        >
          <IconX />
        </IconButton>
      )}
    </div>
  );
}
