import { cn } from "@/lib/utils";

/**
 * Opens a section of a long page: a hairline rule, a display-face title and an
 * optional note set flush right, so a reader scanning down sees where one topic
 * ends and the next begins without a box around each.
 */
export function SectionHead({
  id,
  title,
  note,
  className,
}: {
  id?: string;
  title: string;
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-foreground/80 pt-4", className)}>
      <h2 id={id} className="text-2xl sm:text-[1.75rem]">
        {title}
      </h2>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}
