"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  Eye,
  MousePointer2,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Visual, interactive explainer of how the reading tracker decides to
 * count seconds. Three gates (presence, soft interaction, reading proof)
 * must all be open for the clock to tick — the demo auto-plays scenarios
 * showing each gate flipping closed in turn, with a live "Contando" /
 * "Pausado" badge so the user understands *why* a second was skipped.
 */

type GateKey = "presence" | "interaction" | "reading";

type GateDef = {
  key: GateKey;
  icon: LucideIcon;
  title: string;
  description: string;
};

const GATES: GateDef[] = [
  {
    key: "presence",
    icon: Eye,
    title: "Estás aquí",
    description: "La pestaña está visible y la ventana tiene el foco.",
  },
  {
    key: "interaction",
    icon: MousePointer2,
    title: "Te moviste hace poco",
    description: "Mouse, scroll o teclas en los últimos 45 segundos.",
  },
  {
    key: "reading",
    icon: BookOpen,
    title: "Estás leyendo de verdad",
    description: "Pasaste página o hiciste scroll en los últimos 3 minutos.",
  },
];

type Scenario = {
  label: string;
  gates: Record<GateKey, boolean>;
  caption: string;
};

// Auto-cycled storyboard. Each scenario shows exactly *one* failing gate
// so the cause is unambiguous, plus an "all green" baseline.
const SCENARIOS: Scenario[] = [
  {
    label: "Leyendo activamente",
    gates: { presence: true, interaction: true, reading: true },
    caption: "Las tres condiciones se cumplen. El reloj suma segundos.",
  },
  {
    label: "Cambias de pestaña",
    gates: { presence: false, interaction: true, reading: true },
    caption: "Sin foco en la pestaña → el reloj se pausa al instante.",
  },
  {
    label: "45 s sin actividad",
    gates: { presence: true, interaction: false, reading: true },
    caption: "Si te alejas del teclado, el reloj deja de contar.",
  },
  {
    label: "3 min sin pasar página",
    gates: { presence: true, interaction: true, reading: false },
    caption:
      "Aunque muevas el mouse, sin avanzar el libro no cuenta como lectura.",
  },
];

const SCENARIO_INTERVAL_MS = 3200;

export function TrackingExplainer() {
  const [expanded, setExpanded] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const scenario = SCENARIOS[scenarioIndex];
  const isCounting =
    scenario.gates.presence &&
    scenario.gates.interaction &&
    scenario.gates.reading;

  // Auto-advance through scenarios when the explainer is open + playing.
  useEffect(() => {
    if (!expanded || !playing) return;
    const id = window.setInterval(() => {
      setScenarioIndex((i) => (i + 1) % SCENARIOS.length);
    }, SCENARIO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [expanded, playing]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50/60 dark:hover:bg-zinc-900/80 sm:px-6"
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
            ¿Cómo medimos tu tiempo?
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-600">
            Tres condiciones deciden si el reloj cuenta o se pausa.
          </p>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-slate-400 dark:text-zinc-500"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden border-t border-slate-100 dark:border-zinc-800"
          >
            <div className="space-y-5 p-5 sm:p-6">
              <p className="text-sm leading-6 text-slate-600 dark:text-zinc-400">
                Solo contamos los segundos en los que de verdad estás leyendo.
                Estas tres condiciones deben cumplirse{" "}
                <span className="font-semibold text-slate-900 dark:text-zinc-100">
                  al mismo tiempo
                </span>
                . Si una falla, el reloj se pausa.
              </p>

              {/* Three gate cards — animate their satisfied/failing state */}
              <ol className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
                {GATES.map((gate) => {
                  const open = scenario.gates[gate.key];
                  return (
                    <GateCard key={gate.key} gate={gate} open={open} />
                  );
                })}
              </ol>

              {/* Scenario player */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPlaying((v) => !v)}
                      aria-label={playing ? "Pausar demo" : "Reproducir demo"}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-50"
                    >
                      {playing ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                        Escenario
                      </p>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={scenario.label}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.25 }}
                          className="text-sm font-medium text-slate-900 dark:text-zinc-100"
                        >
                          {scenario.label}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </div>

                  <StatusBadge counting={isCounting} />
                </div>

                <AnimatePresence mode="wait">
                  <motion.p
                    key={scenario.caption}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="mt-3 text-xs leading-5 text-slate-500 dark:text-zinc-500"
                  >
                    {scenario.caption}
                  </motion.p>
                </AnimatePresence>

                {/* Tiny dot indicator for scenario progress */}
                <div className="mt-3 flex items-center gap-1.5">
                  {SCENARIOS.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setScenarioIndex(i);
                        setPlaying(false);
                      }}
                      aria-label={`Ir al escenario ${i + 1}`}
                      className={`h-1 rounded-full transition-all ${
                        i === scenarioIndex
                          ? "w-6 bg-slate-900 dark:bg-zinc-100"
                          : "w-1 bg-slate-300 hover:bg-slate-400 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-[11px] leading-5 text-slate-400 dark:text-zinc-600">
                Las sesiones de menos de 5 segundos se descartan. Tu progreso
                se guarda automáticamente al cambiar de pestaña o cerrar.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GateCard({ gate, open }: { gate: GateDef; open: boolean }) {
  const Icon = gate.icon;
  return (
    <li
      className={`relative overflow-hidden rounded-xl border p-4 transition-colors duration-500 ${
        open
          ? "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          : "border-slate-100 bg-slate-50/40 dark:border-zinc-800 dark:bg-zinc-900/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <motion.span
          animate={
            open
              ? {
                  scale: [1, 1.08, 1],
                }
              : { scale: 1 }
          }
          transition={
            open ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}
          }
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-500 ${
            open
              ? "bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
              : "bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </motion.span>
        <AnimatePresence mode="wait">
          <motion.span
            key={open ? "ok" : "off"}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.2 }}
            className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
              open
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-400 dark:text-zinc-600"
            }`}
          >
            {open ? "OK" : "Falla"}
          </motion.span>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-zinc-100">
        {gate.title}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-500">
        {gate.description}
      </p>
    </li>
  );
}

function StatusBadge({ counting }: { counting: boolean }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={counting ? "counting" : "paused"}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25 }}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
          counting
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        }`}
      >
        <motion.span
          animate={
            counting
              ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }
              : { scale: 1, opacity: 0.6 }
          }
          transition={
            counting
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : {}
          }
          className={`h-1.5 w-1.5 rounded-full ${
            counting ? "bg-emerald-500" : "bg-slate-400 dark:bg-zinc-500"
          }`}
        />
        {counting ? "Contando" : "Pausado"}
      </motion.div>
    </AnimatePresence>
  );
}
