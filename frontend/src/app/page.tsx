"use client";

import type { ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { Manrope } from "next/font/google";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const featureCards = [
  {
    title: "Modo Lectura",
    description:
      "Modo de lectura diseñado para eliminar distracciones y mejorar la concentración.",
    note: "Disponible ahora para sesiones de concentración activa.",
    icon: <ReadIcon />,
    status: "Disponible ahora",
    tone: "available",
  },
  {
    title: "Modo Escritura",
    description:
      "Entorno de escritura minimalista pensado para mantener claridad mental y continuidad creativa.",
    note: "Aún no está disponible. Vendrá pronto.",
    icon: <WriteIcon />,
    status: "Próximamente",
    tone: "soon",
  },
] as const;

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const featuresGridRef = useRef<HTMLDivElement>(null);
  const ambientGlowRef = useRef<HTMLDivElement>(null);
  const orbOneRef = useRef<HTMLDivElement>(null);
  const orbTwoRef = useRef<HTMLDivElement>(null);
  const orbThreeRef = useRef<HTMLDivElement>(null);
  const featureRefOne = useRef<HTMLDivElement>(null);
  const featureRefTwo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

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

      [orbOneRef.current, orbTwoRef.current, orbThreeRef.current].forEach(
        (orb, index) => {
          if (!orb) {
            return;
          }

          gsap.to(orb, {
            x: index === 1 ? -18 : 14,
            y: index === 2 ? -16 : 18,
            scale: 1.05,
            duration: 7 + index,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        },
      );

      if (heroCopyRef.current) {
        gsap.fromTo(
          heroCopyRef.current,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
          },
        );
      }

      [featureRefOne.current, featureRefTwo.current].forEach((element) => {
        if (!element) {
          return;
        }

        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 32 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 82%",
              once: true,
            },
          },
        );
      });

      if (featuresGridRef.current) {
        gsap.fromTo(
          featuresGridRef.current,
          { autoAlpha: 0, y: 34 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: featuresGridRef.current,
              start: "top 80%",
              once: true,
            },
          },
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const setCardState = (card: HTMLDivElement | null, active: boolean) => {
    if (!card) {
      return;
    }

    const iconShell = card.querySelector("[data-icon-shell]");

    gsap.to(card, {
      y: active ? -8 : 0,
      borderColor: active ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.18)",
      boxShadow: active
        ? "0 30px 70px rgba(15, 23, 42, 0.10)"
        : "0 18px 45px rgba(15, 23, 42, 0.05)",
      duration: 0.35,
      ease: "power2.out",
    });

    if (iconShell instanceof HTMLElement) {
      gsap.to(iconShell, {
        y: active ? -2 : 0,
        scale: active ? 1.04 : 1,
        duration: 0.35,
        ease: "power2.out",
      });
    }
  };

  return (
    <main
      id="inicio"
      className={`${manrope.className} relative overflow-x-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_48%,#f4f7fb_100%)] text-slate-950`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          ref={ambientGlowRef}
          className="absolute left-1/2 top-24 h-136 w-136 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(191,219,254,0.42),rgba(255,255,255,0)_68%)] blur-3xl"
        />
        <div
          ref={orbOneRef}
          className="absolute left-[10%] top-28 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(191,219,254,0.42),rgba(255,255,255,0)_68%)] blur-2xl"
        />
        <div
          ref={orbTwoRef}
          className="absolute right-[12%] top-88 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(226,232,240,0.34),rgba(255,255,255,0)_74%)] blur-3xl"
        />
        <div
          ref={orbThreeRef}
          className="absolute bottom-28 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(219,234,254,0.28),rgba(255,255,255,0)_74%)] blur-3xl"
        />
      </div>

      <div
        ref={rootRef}
        className="relative"
      >
        <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-8 sm:px-10 lg:py-10">
          <div
            ref={heroCopyRef}
            className="mx-auto max-w-4xl text-center"
          >
            <div className="flex justify-center">
              <span className="relative inline-flex items-center rounded-full border border-sky-100 bg-white/85 px-5 py-2 text-sm font-semibold shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur">
                <span className="absolute inset-x-6 bottom-0 h-px bg-[linear-gradient(90deg,rgba(125,211,252,0),rgba(125,211,252,0.9),rgba(125,211,252,0))]" />
                <span className="bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_52%,#38bdf8_100%)] bg-clip-text tracking-[-0.04em] text-transparent">
                  FocusHub
                </span>
              </span>
            </div>
            <h1 className="mt-6 text-balance text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
              Entra en estado de focus.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              <span className="bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_55%,#38bdf8_100%)] bg-clip-text font-semibold text-transparent">
                FocusHub
              </span>{" "}
              reduce distracciones, silencia interrupciones y crea un entorno
              tranquilo para que avances con claridad en tu trabajo cognitivo.
            </p>
            <div className="mt-10 flex justify-center">
              <a
                href="#inicio"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Probar FocusHub
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Lectura inmersiva disponible. Escritura próximamente.
              Notificaciones en pausa.
            </p>
          </div>

          <div
            className="mt-10 grid gap-8 lg:mt-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start"
          >
            <div
              ref={featuresGridRef}
              className="grid gap-5 lg:col-span-2 lg:grid-cols-2"
            >
              {featureCards.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  refProp={index === 0 ? featureRefOne : featureRefTwo}
                  icon={feature.icon}
                  description={feature.description}
                  note={feature.note}
                  onMouseEnter={() =>
                    setCardState(
                      index === 0 ? featureRefOne.current : featureRefTwo.current,
                      true,
                    )
                  }
                  onMouseLeave={() =>
                    setCardState(
                      index === 0 ? featureRefOne.current : featureRefTwo.current,
                      false,
                    )
                  }
                  status={feature.status}
                  title={feature.title}
                  tone={feature.tone}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

type FeatureCardProps = {
  description: string;
  icon: ReactNode;
  note: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  refProp: RefObject<HTMLDivElement | null>;
  status: string;
  title: string;
  tone: "available" | "soon";
};

function FeatureCard({
  description,
  icon,
  note,
  onMouseEnter,
  onMouseLeave,
  refProp,
  status,
  title,
  tone,
}: FeatureCardProps) {
  const statusClasses =
    tone === "soon"
      ? "border-sky-100 bg-sky-50/80 text-sky-700"
      : "border-emerald-100 bg-emerald-50/80 text-emerald-700";

  return (
    <article
      ref={refProp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="rounded-[1.8rem] border border-slate-200/70 bg-white/78 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          data-icon-shell
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
        >
          {icon}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusClasses}`}
        >
          {status}
        </span>
      </div>
      <h3 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
        {title}
      </h3>
      <p className="mt-3 max-w-lg text-base leading-7 text-slate-600">
        {description}
      </p>
      <p className="mt-4 text-sm font-medium text-slate-500">{note}</p>
    </article>
  );
}

function ReadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
    >
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
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
    >
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
