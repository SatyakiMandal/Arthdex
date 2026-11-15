import "server-only";
import { apiGet } from "@/lib/api/client";
import { DataUnavailable } from "@/components/ui/data-provenance";

/**
 * A desk with no real data source. The data service's own explanation is shown, so the
 * page says exactly what the API says: what is missing and where it would come from.
 */
export async function NotSourced({ title, path }: { title: string; path: string }) {
  const res = await apiGet<unknown>(path, 3600);
  return (
    <div className="py-10">
      <DataUnavailable title={`${title}: not shown`} message={res.ok ? "This desk is being rebuilt on a real source." : res.message} />
    </div>
  );
}
