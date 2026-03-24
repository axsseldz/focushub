import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "Panel de enfoque | FocusHub",
  description: "Panel principal de FocusHub para acceder a herramientas de concentración.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
