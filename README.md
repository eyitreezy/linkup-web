# LinkUp Web

Desktop evolution of **LinkUp Mobile** — separate Next.js app, same Supabase backend.

- **Mobile repo:** `../linkup` (Expo — do not modify from this project)
- **Stack:** Next.js App Router · TypeScript · Tailwind · Supabase · TanStack Query · Zustand · Framer Motion

## Setup

```bash
cd linkup-web
cp .env.example .env.local
# Paste NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the mobile .env
npm install
npm run dev
```

Add to **Supabase → Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` (or production domain)
- Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/recovery`, `http://localhost:3000/auth/recovery-callback`, `http://localhost:3000/auth/confirm`, `http://localhost:3000/reset-password`

**Password reset (recommended email template)** — In Supabase → Authentication → Email Templates → **Reset password**, set the link to:

```html
<a href="{{ .SiteURL }}/auth/recovery-callback?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

This works in any browser/device. The app also accepts the default Supabase confirmation redirect to `/auth/recovery-callback` (hash or PKCE code).

Enable **Google** under Authentication → Providers (same as mobile).

**Google Web Client ID:** You do **not** put `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in linkup-web for sign-in. That value belongs in **Supabase** (and in Google Cloud as the OAuth Web client). Flow: user → Google → Supabase → `/auth/callback` on your site. Use the same Web client ID you already created for mobile/Supabase.

In **Google Cloud Console** (OAuth client, type Web application), authorized redirect URI must include:

- `https://<your-project-ref>.supabase.co/auth/v1/callback`

In **Supabase → Authentication → URL Configuration**, allow:

- `http://localhost:3000/auth/callback` (dev)
- your production web URL + `/auth/callback`

For maps / location search, copy from mobile `.env`:

- `NEXT_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` (= `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY`)

## Layout

| Breakpoint | Shell |
|------------|--------|
| Desktop (lg+) | Sidebar · center feed · right context panel |
| Tablet (md) | Two-column responsive |
| Mobile browser | Bottom navigation |

## Docs

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for phases, folder structure, and admin split (`linkup-admin/`).

## Deploy

Vercel recommended. Set env vars to match mobile Supabase project. No changes to mobile EAS config required.
