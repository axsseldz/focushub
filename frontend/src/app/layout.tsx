import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "FocusHub",
  description: "Landing page de FocusHub enfocada en concentración profunda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-950">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
