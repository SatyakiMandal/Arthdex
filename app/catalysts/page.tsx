import { redirect } from "next/navigation";

export default function CatalystsPage() {
  redirect("/results?tab=catalysts");
}
