import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Arthdex trademark: an open book under a letter A, a rising arrow and a bar chart
 * (learn, analyse, invest, grow). Supplied by the project's professor as a brand board.
 *
 * The artwork is navy on white, which disappears on the dark theme, so a second file carries the
 * same mark with its navy parts lightened (gold arrow and teal bars unchanged, as in the board's
 * monochrome-white variant). The two are swapped with the theme class.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block h-9 shrink-0", className)} style={{ aspectRatio: "539 / 381" }}>
      <Image src="/brand/arthdex-mark.png" alt="Arthdex" width={539} height={381} priority className="h-full w-auto dark:hidden" />
      <Image src="/brand/arthdex-mark-light.png" alt="Arthdex" width={539} height={381} priority className="hidden h-full w-auto dark:block" />
    </span>
  );
}

/** ArThDex: navy (white on dark) for "ArTh", teal for "Dex", as on the brand board. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-brand font-bold leading-none tracking-[-0.01em] text-[#0B2D5B] dark:text-[#E8EEF4]", className)}>
      ArTh<span className="text-[#00A896]">Dex</span>
    </span>
  );
}

const TAGLINE = ["LEARN", "ANALYZE", "INVEST", "GROW"];

/** Mark beside the wordmark, with the brand's four-word line under it when there is room. */
export function Logo({ tagline = true, full = false, className }: { tagline?: boolean; full?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark />
      <span className="flex flex-col justify-center gap-[5px]">
        <Wordmark className="text-[1.45rem]" />
        {tagline ? (
          <span
            className={cn(
              "items-center gap-[0.45em] whitespace-nowrap font-sans text-[0.5625rem] font-medium leading-none tracking-[0.2em] text-[#0B2D5B]/80 dark:text-[#E8EEF4]/70",
              full ? "flex" : "hidden 2xl:flex",
            )}
          >
            {TAGLINE.map((word, i) => (
              <span key={word} className="inline-flex items-center gap-[0.45em]">
                {i > 0 ? <span aria-hidden className="h-[0.95em] w-px bg-[#F4B942]" /> : null}
                {word}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </span>
  );
}
