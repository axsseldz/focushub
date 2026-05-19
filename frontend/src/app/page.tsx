"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Manrope } from "next/font/google";
import { gsap } from "gsap";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingShowcase } from "@/components/landing/LandingShowcase";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const ambientGlowRef = useRef<HTMLDivElement>(null);
  const orbOneRef = useRef<HTMLDivElement>(null);
  const orbTwoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (ambientGlowRef.current) {
        gsap.to(ambientGlowRef.current, {
          scale: 1.08,
          x: 24,
          y: 18,
          duration: 9,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }

      [orbOneRef.current, orbTwoRef.current].forEach((orb, index) => {
        if (!orb) return;
        gsap.to(orb, {
          x: index === 0 ? 18 : -18,
          y: index === 0 ? 16 : -14,
          scale: 1.05,
          duration: 8 + index,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      if (navRef.current) {
        gsap.fromTo(
          navRef.current,
          { autoAlpha: 0, y: -10 },
          { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" },
        );
      }

      if (heroRef.current) {
        const items = heroRef.current.querySelectorAll("[data-hero-item]");
        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.09,
            ease: "power3.out",
            delay: 0.05,
          },
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <main
      id="inicio"
      className={`${manrope.className} relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_48%,#eef3fb_100%)] text-slate-950 dark:[background-image:none] dark:bg-zinc-950 dark:text-zinc-50`}
    >
      {/* Ambient backdrop — kept very soft so the showcase is the focal point */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          ref={ambientGlowRef}
          className="absolute left-1/2 top-32 h-150 w-150 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(191,219,254,0.42),rgba(255,255,255,0)_68%)] blur-3xl dark:bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),rgba(0,0,0,0)_68%)]"
        />
        <div
          ref={orbOneRef}
          className="absolute left-[8%] top-44 h-44 w-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(191,219,254,0.44),rgba(255,255,255,0)_70%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(96,165,250,0.22),rgba(0,0,0,0)_70%)]"
        />
        <div
          ref={orbTwoRef}
          className="absolute right-[10%] top-72 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(226,232,240,0.36),rgba(255,255,255,0)_74%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(147,197,253,0.16),rgba(0,0,0,0)_74%)]"
        />
      </div>

      <div ref={rootRef} className="relative">
        {/* Top navigation */}
        <nav
          ref={navRef}
          className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8"
        >
          <Link
            href="/"
            className="bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_55%,#38bdf8_100%)] bg-clip-text text-lg font-semibold tracking-[-0.04em] text-transparent transition-opacity hover:opacity-85 dark:bg-[linear-gradient(135deg,#3b82f6_0%,#60a5fa_55%,#93c5fd_100%)] sm:text-xl"
          >
            FocusHub
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </nav>

        {/* Hero — tight: badge, headline, CTAs, then the interactive showcase
            carries the rest of the explanation visually. */}
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:px-10 sm:pt-20 lg:pt-24">
          <div ref={heroRef} className="mx-auto max-w-3xl text-center">
            <h1
              data-hero-item
              className="text-balance text-5xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-zinc-50 sm:text-6xl lg:text-7xl"
            >
              Tu workspace de{" "}
              <span className="bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_55%,#38bdf8_100%)] bg-clip-text text-transparent dark:bg-[linear-gradient(135deg,#3b82f6_0%,#60a5fa_55%,#93c5fd_100%)]">
                productividad
              </span>
              .
            </h1>

            <p
              data-hero-item
              className="mx-auto mt-6 max-w-xl text-balance text-base text-slate-500 dark:text-zinc-400 sm:text-lg"
            >
              Escribe LaTeX con un copiloto de IA, compila a PDFs reales y
              guarda todo lo que lees en un solo lugar — sin caos de pestañas.
            </p>

            <div
              data-hero-item
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Show when="signed-out">
                <SignUpButton mode="modal" fallbackRedirectUrl="/workspace">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-50"
                  >
                    Empezar gratis
                    <ArrowIcon />
                  </button>
                </SignUpButton>
                <SignInButton mode="modal" fallbackRedirectUrl="/workspace">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 px-7 py-3 text-sm font-semibold text-slate-700 backdrop-blur transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:text-zinc-50"
                  >
                    Ya tengo cuenta
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/workspace"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-50"
                >
                  Abrir tu workspace
                  <ArrowIcon />
                </Link>
              </Show>
            </div>
          </div>

          <LandingShowcase />
        </section>
      </div>
    </main>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
