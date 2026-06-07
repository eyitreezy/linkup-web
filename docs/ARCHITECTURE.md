# LinkUp Web — Architecture

## Principles

1. **Separate repo folder** — `linkup-web/` is not a monorepo merge with Expo.
2. **Same backend** — Supabase URL + anon key; RLS and RPCs from mobile migrations.
3. **No duplicated business rules** — escrow release, cancellations, KYC decisions stay in Postgres / Edge Functions.
4. **Brand parity** — tokens from mobile `constants/theme.ts` (`#6C63FF`, `#FF6584`, Inter/Poppins).

## Folder structure

```
linkup-web/
├── public/auth-hero/          # Copied from mobile assets (auth slider)
├── src/
│   ├── app/
│   │   ├── (main)/            # Authenticated shell (sidebar + feed + context)
│   │   ├── login|signup|...   # Auth (glass card + hero)
│   │   └── auth/callback/     # OAuth / email confirm
│   ├── components/
│   │   ├── auth/              # AuthShell, AuthHeroSlider
│   │   ├── layout/            # AppShell, Sidebar, BottomNav, ContextPanel
│   │   └── ui/                # Button, Input, Skeleton
│   ├── features/              # discover, auth, plans, messages, …
│   ├── hooks/                 # useSession
│   ├── lib/
│   │   ├── design/tokens.ts
│   │   └── supabase/          # client, server, middleware
│   ├── services/              # Thin Supabase queries (no client-side money logic)
│   ├── stores/                # Zustand (auth UI state)
│   └── types/database.ts      # Copied from mobile — regen with `supabase gen types` later
└── docs/
```

## Phase map

| Phase | Status | Notes |
|-------|--------|-------|
| 1 Foundation | Done | Next, Tailwind, Supabase SSR, types, tokens |
| 2 Auth | Done | Login, signup, forgot, reset, callback |
| 3 Discover | Started | Mood strip, feed query, card/list toggle |
| 4 Plans | Scaffold | Detail SSR, create/negotiate/agreement routes TBD |
| 5 Messaging | Scaffold | `messages.service` + `/chat/[id]` |
| 6 KYC / Trust | Scaffold | `/trust` |
| 7 Premium | Scaffold | Landing + Paystack via Edge Functions |
| 8 Wallet / Escrow | Scaffold | Read-only services |
| 9 Support | Scaffold | `/support` |
| 10 Admin | Separate | `linkup-admin/` (see below) |

## Desktop layout

```
┌──────────┬─────────────────────────┬─────────────┐
│ Sidebar  │ Main (feed / detail)    │ Context     │
│ Nav      │                         │ Filters     │
└──────────┴─────────────────────────┴─────────────┘
```

Mobile browser: hide sidebar + context; show `BottomNav`.

## Data access rules

- **Reads:** Supabase client + TanStack Query; respect RLS.
- **Writes:** Prefer existing RPCs (`publish_plan`, `submit_plan_cancellation`, `record_agreement_confirmation`, etc.).
- **Payments:** `paystack-initialize` / webhooks — never embed secret keys in web.
- **Types:** `src/types/database.ts` mirrors mobile until automated codegen.

## Admin (`linkup-admin/`)

Separate Next.js app for operators:

- KYC review queue
- Reports & moderation
- Escrow / dispute monitoring
- User management & analytics

Uses Supabase **service role** only on server routes — never exposed to browser.

## Performance checklist

- Server Components for plan detail metadata
- `next/image` for avatars / hero slides
- Route-level loading skeletons (`Skeleton.tsx`)
- Dynamic import heavy modals (negotiation, report sheet) as features grow
- SEO: `metadata` on marketing/auth pages

## Consistency test

Switching mobile ↔ web should preserve:

- Purple/coral brand
- Trust chips & verification language
- Escrow / cancellation copy (server-enforced)
- Premium gradient CTAs
