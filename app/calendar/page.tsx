import { redirect } from "next/navigation";

export default function CalendarPage() {
  redirect("/results?tab=calendar");
}
