import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { FocusModeProvider } from "@/lib/focus-mode";
import { ToasterMount } from "@/components/ToasterMount";

export const metadata: Metadata = {
  title: "FocusHub",
  description: "Tu workspace de productividad. Escribe LaTeX con IA, compila a PDF y guarda todo lo que lees en un solo lugar.",
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
        <ClerkProvider
          localization={esES}
          afterSignOutUrl="/"
          appearance={{
            variables: {
              colorPrimary: "#0f172a",
              borderRadius: "0.85rem",
              fontFamily: "var(--font-sans, system-ui)",
            },
          }}
        >
          <ThemeProvider>
            <FocusModeProvider>{children}</FocusModeProvider>
            <ToasterMount />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
