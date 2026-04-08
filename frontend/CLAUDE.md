# Frontend

Next.js 16.2 with App Router, React 19, TypeScript, Tailwind v4, GSAP.

## Key notes

- **Tailwind v4** — no `tailwind.config.js`; utility config lives in CSS files. Class names follow the same convention but some v3 utilities may not exist.
- **React 19** — use the new `use` hook where applicable; avoid legacy patterns like `forwardRef`.
- **App Router** — all pages are in `src/app/`. Server components by default; add `"use client"` only when you need browser APIs, state, or effects.
- **GSAP animations** — animations live in `useEffect` with a `gsap.context()` that's reverted on cleanup. Follow this pattern for any new animations.

## File structure

```
src/
├── app/
│   ├── layout.tsx          # root layout
│   ├── page.tsx            # landing page (/)
│   ├── dashboard/page.tsx  # dashboard (/dashboard)
│   └── lectura/page.tsx    # reading mode (/lectura)
├── components/
│   ├── dashboard/          # sidebar, activity cards
│   └── reading-mode/       # PDF reader, book cards, library
├── lib/
│   └── pdf.ts              # PDF utilities
└── types/
    └── book.ts             # shared types
```
