"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Manrope } from "next/font/google";
import { gsap } from "gsap";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const highlights = [
  {
    title: "Lectura inmersiva",
    description:
      "Visor de PDF sin distracciones, con seguimiento del tiempo activo y estadísticas reales.",
    icon: <ReadIcon />,
    status: "Disponible",
    tone: "available" as const,
  },
  {
    title: "Escritura enfocada",
    description:
      "Un entorno minimalista para escribir con claridad mental y continuidad creativa.",
    icon: <WriteIcon />,
    status: "Próximamente",
    tone: "soon" as const,
  },
];

const benefits = [
  "Reduce distracciones y silencia el ruido",
  "Mide tu tiempo real de concentración",
  "Mantén tu progreso y tu biblioteca privados",
];

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLUListElement>(null);
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

      if (cardsRef.current) {
        gsap.fromTo(
          cardsRef.current.querySelectorAll("[data-card]"),
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.1,
            ease: "power3.out",
            delay: 0.45,
          },
        );
      }

      if (benefitsRef.current) {
        gsap.fromTo(
          benefitsRef.current.querySelectorAll("li"),
          { autoAlpha: 0, x: -10 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.7,
            stagger: 0.08,
            ease: "power3.out",
            delay: 0.3,
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
      {/* Ambient backdrop */}
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
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="hidden rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-zinc-400 dark:hover:text-zinc-100 sm:inline-flex"
                >
                  Iniciar sesión
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-50"
                >
                  Crear cuenta
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-50"
              >
                Ir al panel
              </Link>
              <UserButton />
            </Show>
          </div>
        </nav>

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:px-10 sm:pt-20 lg:pt-24">
          <div ref={heroRef} className="mx-auto max-w-3xl text-center">
            <span
              data-hero-item
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Concentración profunda
            </span>
            <h1
              data-hero-item
              className="mt-6 text-balance text-5xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-zinc-50 sm:text-6xl lg:text-7xl"
            >
              Entra en estado de{" "}
              <span className="bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_55%,#38bdf8_100%)] bg-clip-text text-transparent dark:bg-[linear-gradient(135deg,#3b82f6_0%,#60a5fa_55%,#93c5fd_100%)]">
                focus
              </span>
              .
            </h1>
            <p
              data-hero-item
              className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-600 dark:text-zinc-400 sm:text-xl"
            >
              FocusHub crea un entorno tranquilo para tu trabajo cognitivo. Lee
              y, muy pronto, escribe — sin distracciones, con métricas reales y
              tu propio espacio privado.
            </p>

            <div
              data-hero-item
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-7 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-slate-800 hover:shadow-[0_14px_30px_rgba(15,23,42,0.18)] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-50"
                  >
                    Empezar gratis
                    <ArrowIcon />
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
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
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-7 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-slate-800 hover:shadow-[0_14px_30px_rgba(15,23,42,0.18)] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-50"
                >
                  Entrar al panel
                  <ArrowIcon />
                </Link>
              </Show>
            </div>

            <ul
              ref={benefitsRef}
              data-hero-item
              className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-500 dark:text-zinc-500"
            >
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <CheckIcon />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Highlight cards */}
          <div
            ref={cardsRef}
            className="mx-auto mt-20 grid max-w-4xl gap-5 sm:grid-cols-2"
          >
            {highlights.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                description={feature.description}
                status={feature.status}
                title={feature.title}
                tone={feature.tone}
              />
            ))}
          </div>

          <p className="mx-auto mt-12 max-w-xl text-center text-xs text-slate-400 dark:text-zinc-600">
            Crea tu cuenta para guardar tu biblioteca, tu progreso y tus rachas
            de lectura de forma privada.
          </p>
        </section>
      </div>
    </main>
  );
}

type FeatureCardProps = {
  description: string;
  icon: ReactNode;
  status: string;
  title: string;
  tone: "available" | "soon";
};

function FeatureCard({
  description,
  icon,
  status,
  title,
  tone,
}: FeatureCardProps) {
  const statusClasses =
    tone === "soon"
      ? "border-sky-100 bg-sky-50/80 text-sky-700 dark:border-sky-900 dark:bg-sky-900/30 dark:text-sky-400"
      : "border-emerald-100 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400";

  return (
    <article
      data-card
      className="group rounded-[1.6rem] border border-slate-200/70 bg-white/78 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_28px_60px_rgba(15,23,42,0.1)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-transform duration-300 group-hover:scale-105 dark:border-zinc-700 dark:bg-zinc-800 dark:[background-image:none] dark:text-zinc-200">
          {icon}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClasses}`}
        >
          {status}
        </span>
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
        {description}
      </p>
    </article>
  );
}

function ReadIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.75 6.75A2.75 2.75 0 0 1 7.5 4h10.25a1.5 1.5 0 0 1 1.5 1.5v12.75H8.25A3.25 3.25 0 0 0 5 21.5V7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M8 8.25h7.5M8 11.75h7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function WriteIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.75 18.25V19.5h1.25L17.4 8.1l-2.5-2.5L4.75 15.75v2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="m13.95 6.55 2.5 2.5M9 19.5h10.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-emerald-500"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m5 12.5 4 4 10-10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
