# Frontend

Next.js 16.2 with App Router, React 19, TypeScript, Tailwind v4, GSAP, Clerk auth.

## Key notes

- **Tailwind v4** — no `tailwind.config.js`; utility config lives in CSS files. Class names follow the same convention but some v3 utilities may not exist.
- **React 19** — use the new `use` hook where applicable; avoid legacy patterns like `forwardRef`.
- **App Router** — all pages are in `src/app/`. Server components by default; add `"use client"` only when you need browser APIs, state, or effects.
- **GSAP animations** — animations live in `useEffect` with a `gsap.context()` that's reverted on cleanup. Follow this pattern for any new animations.
- **Clerk** — `<ClerkProvider>` wraps the tree in `app/layout.tsx`, Spanish-localized via `@clerk/localizations`' `esES`. Sign-in / sign-up are launched as modals from the landing page; protected routes (`/dashboard`, `/lectura`, `/analitica`) are enforced by `clerkMiddleware()` in `src/proxy.ts`. Use `<Show when="signed-in|signed-out">` instead of the deprecated `<SignedIn>` / `<SignedOut>`.

## File structure

```
src/
├── app/
│   ├── layout.tsx          # root layout (wraps tree in <ClerkProvider>)
│   ├── page.tsx            # public landing page (/) with modal sign-in / sign-up
│   ├── dashboard/page.tsx  # dashboard (/dashboard) — protected
│   ├── lectura/page.tsx    # reading mode (/lectura) — protected
│   └── analitica/page.tsx  # analytics (/analitica) — protected
├── components/
│   ├── analytics/          # analytics view, charts, heatmap, streak cards
│   ├── dashboard/          # sidebar, activity cards
│   └── reading-mode/       # PDF reader, book cards, library
├── lib/
│   ├── api.ts              # useAuthedFetch — injects X-User-Id header
│   ├── analytics.ts        # client-side bucketing + per-user goal storage
│   ├── pdf.ts              # PDF utilities
│   ├── reading-tracker.ts  # active-reading-time tracker
│   ├── theme.tsx           # light/dark mode provider
│   └── focus-mode.tsx      # focus-mode provider
├── proxy.ts                # Clerk middleware (route protection)
└── types/
    └── book.ts             # shared types
```

## Backend API calls

Every fetch against the FastAPI backend must include the `X-User-Id` header (Clerk user ID). Use the `useAuthedFetch()` hook from `src/lib/api.ts`:

```ts
const authedFetch = useAuthedFetch();
const { isLoaded, isSignedIn } = useAuth();

useEffect(() => {
  if (!isLoaded || !isSignedIn) return;
  void authedFetch(`${API_BASE_URL}/files`).then(...);
}, [authedFetch, isLoaded, isSignedIn]);
```

The reading tracker (`lib/reading-tracker.ts`) reads the Clerk user ID via `useAuth()` and persists it inside each queued session so retries after reloads still go to the right account.
