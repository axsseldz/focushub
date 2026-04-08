"use client";

import { useEffect, useRef } from "react";
import { Manrope } from "next/font/google";
import { gsap } from "gsap";
import {
  ActivityCard,
  ReadingIcon,
  WritingIcon,
} from "@/components/dashboard/ActivityCard";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export function DashboardView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const readingCardRef = useRef<HTMLDivElement>(null);
  const writingCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (sidebarRef.current) {
        gsap.fromTo(
          sidebarRef.current,
          { autoAlpha: 0, x: -16 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.7,
            ease: "power3.out",
          },
        );
      }

      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            delay: 0.06,
            ease: "power3.out",
          },
        );
      }

      const cards = [
        readingCardRef.current,
        writingCardRef.current,
      ].filter((card): card is HTMLDivElement => card instanceof HTMLDivElement);

      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { autoAlpha: 0, y: 22 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
            delay: 0.12,
            stagger: 0.08,
            ease: "power3.out",
          },
        );
      }

      const hazes = rootRef.current?.querySelectorAll("[data-disabled-haze]");

      if (hazes && hazes.length > 0) {
        gsap.to(hazes, {
          opacity: 0.38,
          duration: 2.6,
          stagger: 0.12,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const setReadingCardState = (active: boolean) => {
    const card = readingCardRef.current;

    if (!card) {
      return;
    }

    const icon = card.querySelector("[data-card-icon]");
    const action = card.querySelector("[data-card-action]");

    gsap.to(card, {
      y: active ? -6 : 0,
      borderColor: active ? "rgba(148, 163, 184, 0.36)" : "rgba(226, 232, 240, 0.8)",
      boxShadow: active
        ? "0 22px 50px rgba(15, 23, 42, 0.08)"
        : "0 14px 36px rgba(15, 23, 42, 0.045)",
      duration: 0.32,
      ease: "power2.out",
    });

    if (icon instanceof HTMLElement) {
      gsap.to(icon, {
        y: active ? -1 : 0,
        scale: active ? 1.03 : 1,
        duration: 0.32,
        ease: "power2.out",
      });
    }

    if (action instanceof HTMLElement) {
      gsap.to(action, {
        y: active ? -1 : 0,
        scale: active ? 1.02 : 1,
        duration: 0.32,
        ease: "power2.out",
      });
    }
  };

  return (
    <main
      className={`${manrope.className} min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50`}
    >
      <div
        ref={rootRef}
        className="h-screen w-full"
      >
        <div className="h-full overflow-hidden bg-white dark:bg-slate-950">
          <div className="grid h-full min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
            <div
              ref={sidebarRef}
              className="border-b border-slate-200/80 dark:border-slate-800 lg:border-b-0 lg:border-r"
            >
              <Sidebar />
            </div>

            <div className="min-w-0">
              <header
                ref={headerRef}
                className="border-b border-slate-200/80 px-6 py-7 dark:border-slate-800 sm:px-8 sm:py-8"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-slate-50 sm:text-4xl">
                      Panel de focus
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg">
                      Selecciona una actividad para entrar en estado de focus.
                    </p>
                  </div>
                  <div className="mt-1 shrink-0">
                    <ThemeToggle />
                  </div>
                </div>
              </header>

              <section
                id="actividades"
                aria-labelledby="actividades-title"
                className="px-6 py-7 sm:px-8 sm:py-8"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2
                      id="actividades-title"
                      className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50"
                    >
                      Actividades
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
                      Herramientas disponibles.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div>
                    <ActivityCard
                      actionHref="/lectura"
                      actionLabel="Comenzar sesión"
                      cardRef={readingCardRef}
                      description="Experiencia de lectura inmersiva diseñada para eliminar distracciones y mejorar la concentración."
                      icon={<ReadingIcon />}
                      onMouseEnter={() => setReadingCardState(true)}
                      onMouseLeave={() => setReadingCardState(false)}
                      title="Modo Lectura"
                    />
                  </div>

                  <div>
                    <ActivityCard
                      cardRef={writingCardRef}
                      description="Entorno de escritura minimalista diseñado para mantener claridad mental y continuidad creativa."
                      disabled
                      icon={<WritingIcon />}
                      label="Próximamente"
                      title="Modo Escritura"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
