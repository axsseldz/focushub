import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const metadata: Metadata = {
  title: "Analítica | FocusHub",
  description:
    "Sigue tu progreso de lectura, racha diaria y logros en FocusHub.",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
