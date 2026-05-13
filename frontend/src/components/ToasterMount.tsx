"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";

export function ToasterMount() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      richColors
      closeButton
      duration={3500}
      toastOptions={{
        style: {
          borderRadius: "9999px",
          padding: "0.6rem 1rem",
          fontSize: "0.875rem",
        },
      }}
    />
  );
}
