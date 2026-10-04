import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Arthdex trademark, laid out as the brand board's horizontal logo: the open-book A mark,
 * a thin gold rule, then the name over the line LEARN | ANALYZE | INVEST | GROW.
 *
 * The artwork is navy on white, which disappears on the dark theme, so a second file carries the
 * same mark with its navy parts lightened (gold arrow and teal bars unchanged, as in the board's
 * monochrome-white variant). The two are swapped with the theme class.
 *
 * Brand colours: navy #0B2D5B, teal #00A896, gold #F4B942, light #E8EEF4.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block h-10 shrink-0", className)} style={{ aspectRatio: "539 / 381" }}>
      <Image src="/brand/arthdex-mark.png" alt="Arthdex" width={539} height={381} priority className="h-full w-auto dark:hidden" />
      <Image src="/brand/arthdex-mark-light.png" alt="Arthdex" width={539} height={381} priority className="hidden h-full w-auto dark:block" />
    </span>
  );
}

/** ArThDex: navy (light on dark) for "ArTh", teal for "Dex", as on the brand board. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-brand font-bold leading-none tracking-[-0.01em] text-[#0B2D5B] dark:text-[#E8EEF4]", className)}>
      ArTh<span className="text-[#00A896]">Dex</span>
    </span>
  );
}

const TAGLINE = ["LEARN", "ANALYZE", "INVEST", "GROW"];

/** Mark | name over the four-word line. The line shows from 1280px up; below that the header has no room for it. */
export function Logo({ tagline = true, className }: { tagline?: boolean; full?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span aria-hidden className="hidden h-9 w-px bg-[#F4B942] sm:block" />
      <span className="flex flex-col justify-center gap-[6px]">
        <Wordmark className="text-[1.4rem]" />
        {tagline ? (
          <span className="hidden items-center gap-[0.4em] whitespace-nowrap font-sans text-[0.5rem] font-medium leading-none tracking-[0.17em] text-[#0B2D5B]/85 dark:text-[#E8EEF4]/75 xl:flex">
            {TAGLINE.map((word, i) => (
              <span key={word} className="inline-flex items-center gap-[0.4em]">
                {i > 0 ? <span aria-hidden className="h-[1.05em] w-px bg-[#F4B942]" /> : null}
                {word}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </span>
  );
}
