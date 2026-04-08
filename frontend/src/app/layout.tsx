import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "FocusHub",
  description: "Landing page de FocusHub enfocada en concentración profunda.",
};

// Runs before React hydrates so the `dark` class is already on <html>.
// Prevents a flash of light mode and keeps SSR/CSR CSS in sync.
const themeInitScript = `(function(){try{if(localStorage.getItem("focushub-theme")==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
