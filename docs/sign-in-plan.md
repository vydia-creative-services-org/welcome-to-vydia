# Passwordless Sign-in: Implementation Plan

> Scope: the "Email and sign in" block in [`TASKS.md`](../TASKS.md).
> Builds on [`docs/plan.md`](./plan.md) §4.3 (Supabase setup), §8 (Authentication), and §9 (Access control). This plan **replaces** §8.4 (login page) and §8.5 (auth routes) of that document. Everything else there still holds.

---

## 0. TL;DR

Two ways to sign in, and **no accounts or passwords**:

1. **Continue with Google**.
2. **Email me a sign-in link** (a Supabase magic link).

The flow only works for people who are already approved:

- A magic link is only ever **sent** to an email that is on some artist's **Allowed emails**, on Website → **Internal viewers**, or on the permanent list. Every visitor sees the same "check your email" screen, so the form can't be used to find out who is a Vydia client.
- A Google account that isn't approved anywhere is signed straight back out.
- Each artist page still runs the same per-artist check as today (§9 of the main plan). That check is the real gate. The two points above just stop strangers from getting sessions at all.

Who can see an artist page after this change:

| Who | Where it's configured | Sees |
|---|---|---|
| The artist's own emails | Artist → Access → **Allowed emails** (Studio) | That artist's page |
| `creativeservices@vydia.com`, `labelservices@vydia.com` | `PERMANENT_VIEWER_EMAILS` env var (code fallback in `lib/access.ts`) | Every artist page |
| `erica.johnson@vydia.com`, `mason.omara@vydia.com` (and anyone added later) | Website → Access → **Internal viewers** (Studio) | Every artist page |
| Anyone else | — | Can't get a sign-in link. A Google sign-in is rejected. |

Sessions stay effectively never-ending (D11): Supabase refresh tokens never time out, and the proxy re-issues the 400-day cookies on every visit.

---

## 1. Decisions

Numbering continues from the main plan (D1–D15).

| # | Decision | Why |
|---|---|---|
| D16 | **Passwordless only: Google + email magic link.** Remove sign-up, password sign-in, "forgot password", `/account/update-password`, and the reset email template. | TASKS: "access without having to create an account". Nothing left to remember or reset. Existing Supabase users (shared inboxes, testers) keep working: a magic link to the same email signs into the same user. |
| D17 | **Magic links are only sent to approved emails, and the response never says which.** The approval lookup and the send both run in `after()`, once the response is already on its way. | "Only these people." Random addresses never become Supabase users and never cost email quota. Because the work happens after the response, approved and unknown emails get the same answer at the same speed (the same idea as D4). |
| D18 | **The email link opens a "Finish signing in" page with a Continue button.** Clicking it runs a server action that verifies the `token_hash`. `/auth/confirm` becomes a page instead of a GET route handler. | Email security scanners (Outlook Safe Links, Mimecast, Proofpoint…) open every link in an email. Today's GET route would spend the single-use token on the scanner's visit, and the artist would get "link expired". Scanners don't submit forms. This is still magic link only (no code to type). Dropping the page is a 10-line change if you'd rather not have the extra click (§5.7). |
| D19 | **Verify links by `token_hash`, not by PKCE code exchange.** The link works in any browser, not only the one that asked for it. | A PKCE link (`/auth/callback?code=…`) needs a cookie from the browser that asked for it, so it fails in the Gmail app's in-app browser. `verifyOtp({token_hash})` has no such requirement. The trade-off: the session lands in whichever browser opens the link, so the email says "open it in the browser you want to stay signed in on". |
| D20 | **Google accounts that aren't approved anywhere are signed out in `/auth/callback`**, which sends them to `/login?error=not-approved`. | Supabase creates a user for any Google account, and we can't stop that without an Auth hook (§10). Signing them out means they never hold a session. This can tell the visitor whether their own Google email is approved, which is fine: Google has already proved they own it. |
| D21 | **All auth runs on the server.** Google sign-in becomes a server action, and the browser Supabase client (`lib/supabase/client.ts`) is deleted. | Every auth cookie is then written by a `Set-Cookie` header. Safari limits cookies written by JavaScript to 7 days, which would quietly break "never-ending sessions" on iPhones and Macs. |
| D22 | **Permanent viewers are `creativeservices@` and `labelservices@`.** `labelrelationships@` is dropped. Named people (`erica.johnson@`, `mason.omara@`) go on Website → Internal viewers. | Your answers. That field already exists on the Website schema (`sanity/schemaTypes/website.ts:20`). This plan moves it to a clearly labelled **Access** tab and seeds the two names. |

---

## 2. The flows

### 2.1 Email magic link

```
/test-artist (signed out)
  └─ proxy → /login?next=/test-artist
       └─ enter email → [Email me a sign-in link]
            ├─ server action returns at once: "If jane@… has access, a link is on its way"
            └─ after():  approved anywhere?  ── no ─→ do nothing
                              │ yes
                              ▼
                 supabase.auth.signInWithOtp({email, emailRedirectTo: SITE_URL + next})
                              ▼
            Email: "Sign in to Welcome to Vydia" → {{SiteURL}}/auth/confirm?token_hash=…&type=email&redirect_to=…
                              ▼
            /auth/confirm (page): "Finish signing in"  [Continue]
                              ▼   (POST, server action)
            verifyOtp({type: 'email', token_hash}) → session cookies → redirect(/test-artist)
                              ▼
            /test-artist → per-artist access check (unchanged) → page or "This page isn't available"
```

### 2.2 Google

```
/login?next=/test-artist → [Continue with Google]  (form → server action)
  └─ signInWithOAuth (server; the PKCE verifier cookie is set by Set-Cookie) → redirect to accounts.google.com
       └─ Google → Supabase → /auth/callback?code=…&next=/test-artist
            └─ exchangeCodeForSession
                 ├─ approved anywhere → redirect(/test-artist)
                 └─ not approved      → signOut → /login?error=not-approved
```

### 2.3 Returning visitor

No sign-in screen at all. The proxy refreshes the access token from the refresh-token cookie and re-sends the cookies with a fresh 400-day max-age (§7).

---

## 3. Files at a glance

| Change | File |
|---|---|
| Edit | `lib/access.ts`: new permanent-viewer default, `isApprovedAnywhere`, `canSignIn` |
| Edit | `lib/sanity/queries.ts`: `APPROVED_EMAILS_QUERY` (then `npm run typegen`) |
| New | `lib/supabase/stateless.ts`: a cookie-less Supabase client for sending links from `after()` |
| New | `lib/form.ts`: the shared `field()` helper |
| Rewrite | `app/(site)/login/actions.ts`: `sendMagicLink`, `signInWithGoogle` |
| Rewrite | `app/(site)/login/LoginForm.tsx` (+ one class in `LoginForm.module.css`) |
| New | `app/(site)/login/errors.ts` |
| Edit | `app/(site)/login/page.tsx` |
| Delete | `app/(site)/auth/confirm/route.ts` |
| New | `app/(site)/auth/confirm/page.tsx`, `app/(site)/auth/confirm/actions.ts` |
| Edit | `app/(site)/auth/callback/route.ts`: reject unapproved Google accounts |
| Delete | `app/(site)/account/update-password/` (both files), `lib/supabase/client.ts`, `supabase/templates/reset-password.html` |
| New / rewrite | `supabase/templates/magic-link.html`, `supabase/templates/confirm-signup.html` |
| Edit | `sanity/schemaTypes/website.ts`, `sanity/schemaTypes/artist.ts` (descriptions, Access tab) |
| Edit | `scripts/seed.ts`: seed the two internal viewers |
| Edit | `.env.example`, `README.md`, `docs/editor-guide.md`, `docs/plan.md` (D16–D22 and a pointer here) |
| Edit | `tests/access.test.ts`, `tests/safe-redirect.test.ts`, `tests/e2e/*`, `scripts/e2e-fixtures.ts`, `.github/workflows/e2e-preview.yml` |
| New | `tests/e2e/sign-in.spec.ts` |

`proxy.ts` and `lib/supabase/proxy.ts` don't change: `/login` and `/auth/*` are already public.

---

## 4. Access layer

### 4.1 Query: every approved email

```ts
// lib/sanity/queries.ts (add)
export const APPROVED_EMAILS_QUERY = defineQuery(`{
  "artistEmails": *[_type == "artist" && defined(slug.current)].allowedEmails[],
  "internalViewers": *[_type == "website" && _id == "website"][0].internalViewerEmails
}`)
```

Run `npm run typegen` to generate `APPROVED_EMAILS_QUERY_RESULT` (`artistEmails: Array<string | null>`, `internalViewers: Array<string> | null`). The result is a flat list, cached with the `artist` and `website` tags, so the publish webhook keeps it fresh. A few hundred artists × a few emails is a few KB.

GROQ has no `trim()`, so case and whitespace are normalized in TypeScript, the same way `decideAccess` does it.

### 4.2 `lib/access.ts`

```ts
import {APPROVED_EMAILS_QUERY, ACCESS_QUERY} from './sanity/queries'
import type {ACCESS_QUERY_RESULT, APPROVED_EMAILS_QUERY_RESULT} from './sanity/types.generated'

const PERMANENT_VIEWERS = new Set(
  (process.env.PERMANENT_VIEWER_EMAILS ?? 'labelservices@vydia.com,creativeservices@vydia.com')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean),
)

// …isInternalViewer, decideAccess, verifiedEmail, normalizeSlug, resolveArtistAccess unchanged…

export function isApprovedAnywhere(email: string, lookup: APPROVED_EMAILS_QUERY_RESULT) {
  const normalized = normalizeEmail(email)
  return (
    isInternalViewer(normalized, lookup.internalViewers) ||
    lookup.artistEmails.some((allowed) => allowed !== null && normalizeEmail(allowed) === normalized)
  )
}

export async function canSignIn(email: string) {
  return isApprovedAnywhere(email, await sanityFetch(APPROVED_EMAILS_QUERY, {}, ['artist', 'website']))
}
```

`canSignIn` decides only who gets a session. `resolveArtistAccess` still decides which page they see. Someone approved on artist A who opens artist B's URL still gets "This page isn't available".

---

## 5. Sign-in code

### 5.1 Shared form helper

```ts
// lib/form.ts
export const field = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
```

### 5.2 Cookie-less Supabase client

```ts
// lib/supabase/stateless.ts
import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'

// No session or cookies: magic links are sent from after(), once the response is gone, and are verified by token hash.
export const createStatelessClient = () =>
  createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit'},
  })
```

Why not the cookie client from `lib/supabase/server.ts`? Its default PKCE flow tries to write a code-verifier cookie. Inside `after()` that write fails silently, and the cookie isn't needed anyway.

### 5.3 Server actions

```ts
// app/(site)/login/actions.ts
'use server'
import {redirect} from 'next/navigation'
import {after} from 'next/server'
import {canSignIn, normalizeEmail} from '@/lib/access'
import {SITE_URL} from '@/lib/env'
import {field} from '@/lib/form'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'
import {createStatelessClient} from '@/lib/supabase/stateless'
import {EMAIL_PATTERN} from '@/sanity/schemaTypes/shared'

export type LinkState = {sentTo?: string; error?: string}

export async function sendMagicLink(_: LinkState, form: FormData): Promise<LinkState> {
  const email = normalizeEmail(field(form, 'email'))
  if (!EMAIL_PATTERN.test(email)) return {error: 'Enter your full email address.'}
  // The email template puts this into a query string as-is, so drop any query of our own (artist pages have none).
  const redirectTo = `${SITE_URL}${safeNext(field(form, 'next')).split('?')[0]}`

  // The lookup and the send happen after the response, so approved and unknown emails get the same answer at the
  // same speed and this form can't reveal who is a Vydia client.
  after(async () => {
    try {
      if (!(await canSignIn(email))) return
      const {error} = await createStatelessClient().auth.signInWithOtp({
        email,
        options: {shouldCreateUser: true, emailRedirectTo: redirectTo},
      })
      if (error) console.error('Magic link not sent:', error.code ?? error.message)
    } catch (error) {
      console.error('Magic link not sent:', error)
    }
  })

  return {sentTo: email}
}

export async function signInWithGoogle(form: FormData) {
  const next = safeNext(field(form, 'next'))
  const supabase = await createClient()
  const {data, error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {prompt: 'select_account'},
    },
  })
  if (error || !data.url) redirect(`/login?error=google&next=${encodeURIComponent(next)}`)
  redirect(data.url)
}
```

Notes:
- `shouldCreateUser: true` is safe because the send only runs for approved emails. A first-time artist gets a Supabase user created silently. That's the "no account" experience.
- Supabase limits each email to one link per 60 seconds, plus an hourly project-wide cap. Errors only go to the server log, because showing them would reveal which emails are approved. The UI's 60-second resend cooldown (§5.4) matches the per-email limit, so real users don't run into it.
- `signInWithGoogle` uses the cookie client on purpose. It needs the PKCE verifier cookie, which `/auth/callback` reads, and server actions can set cookies (D21).

### 5.4 Login form

```tsx
// app/(site)/login/LoginForm.tsx
'use client'
import {useActionState, useEffect, useState} from 'react'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {sendMagicLink, signInWithGoogle, type LinkState} from './actions'
import styles from './LoginForm.module.css'

// Supabase sends at most one link per email every 60 seconds.
const RESEND_AFTER_MS = 60_000

type SentState = LinkState & {sentAt?: number}

async function send(previous: SentState, form: FormData): Promise<SentState> {
  const result = await sendMagicLink(previous, form)
  return result.sentTo ? {...result, sentAt: Date.now()} : result
}

function useSecondsUntil(deadline: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

function SignInSteps({next, error, onReset}: {next: string; error: string | null; onReset: () => void}) {
  const [state, formAction, pending] = useActionState<SentState, FormData>(send, {})
  const secondsLeft = useSecondsUntil((state.sentAt ?? 0) + RESEND_AFTER_MS)

  if (state.sentTo) {
    return (
      <>
        <h1 className={styles.title}>Check your email</h1>
        <p role="status" className={styles.lede}>
          If <strong>{state.sentTo}</strong> has access, a sign-in link is on its way. It works once and expires in 1
          hour. Open it in the browser you want to stay signed in on.
        </p>
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="email" value={state.sentTo} />
          <input type="hidden" name="next" value={next} />
          <button disabled={pending || secondsLeft > 0} className={ui.button}>
            {secondsLeft > 0 ? `Resend link in ${secondsLeft}s` : 'Resend link'}
          </button>
        </form>
        <div className={styles.footer}>
          <button type="button" className={ui.textButton} onClick={onReset}>
            Use a different email
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className={styles.title}>Sign in</h1>
      <p className={styles.lede}>Use the email your Vydia representative has on file for you.</p>

      {error && (
        <p role="alert" className={cx(ui.error, styles.notice)}>
          {error}
        </p>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button className={ui.button}>Continue with Google</button>
      </form>

      <div className={styles.divider}>or</div>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />
        <label className={styles.field}>
          <span className="visually-hidden">Email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="Email" className={ui.input} />
        </label>
        <button disabled={pending} className={cx(ui.button, ui.primary)}>
          Email me a sign-in link
        </button>
      </form>
      {state.error && (
        <p role="alert" className={cx(ui.error, styles.feedback)}>
          {state.error}
        </p>
      )}
    </>
  )
}

export function LoginForm({next, error}: {next: string; error: string | null}) {
  // A new key throws away the "sent" state, so "Use a different email" starts over.
  const [attempt, setAttempt] = useState(0)
  return (
    <div className={styles.card}>
      <SignInSteps key={attempt} next={next} error={attempt === 0 ? error : null} onReset={() => setAttempt((n) => n + 1)} />
    </div>
  )
}
```

```css
/* app/(site)/login/LoginForm.module.css (add) */
.lede {
  margin-bottom: var(--space-4);
  font-size: 14px;
  line-height: 1.5;
}
```

Both buttons are plain `<form>`s, so Google and sending a link still work before the page's JavaScript loads (or without it).

### 5.5 Login errors and page

```ts
// app/(site)/login/errors.ts
const LOGIN_ERRORS = {
  link: 'That sign-in link is invalid, expired, or already used. Enter your email to get a new one.',
  google: 'Google sign-in isn’t available right now. Please use your email instead.',
  'not-approved':
    'That Google account doesn’t have access to any Vydia pages. Sign in with the email your Vydia representative has on file for you.',
}

export const loginErrorMessage = (raw: string | string[] | undefined): string | null =>
  Object.entries(LOGIN_ERRORS).find(([key]) => key === raw)?.[1] ?? null
```

```tsx
// app/(site)/login/page.tsx
import {PageShell} from '@/components/PageShell'
import {safeNext} from '@/lib/safe-redirect'
import {loginErrorMessage} from './errors'
import {LoginForm} from './LoginForm'

export const instant = false

export default async function LoginPage({searchParams}: PageProps<'/login'>) {
  const {next, error} = await searchParams
  return (
    <PageShell>
      <LoginForm next={safeNext(typeof next === 'string' ? next : null)} error={loginErrorMessage(error)} />
    </PageShell>
  )
}
```

The message text always comes from the fixed table above, never from the URL.

### 5.6 `/auth/callback` (Google)

```ts
// app/(site)/auth/callback/route.ts
import {NextResponse, type NextRequest} from 'next/server'
import {canSignIn, verifiedEmail} from '@/lib/access'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const {searchParams, origin} = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const supabase = await createClient()

  if (code) {
    const {data, error} = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const email = verifiedEmail(data.user)
      if (email && (await canSignIn(email))) return NextResponse.redirect(`${origin}${next}`)
      // Supabase creates a user for any Google account; an unapproved one never keeps a session.
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=not-approved&next=${encodeURIComponent(next)}`)
    }
  } else {
    const {data} = await supabase.auth.getClaims()
    if (data?.claims) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=link&next=${encodeURIComponent(next)}`)
}
```

### 5.7 `/auth/confirm`: the "Finish signing in" page (D18)

Delete `app/(site)/auth/confirm/route.ts`. A segment can't have both `route.ts` and `page.tsx`. The new page accepts the same query parameters, so confirmation links already sitting in inboxes still work, with one extra click.

```tsx
// app/(site)/auth/confirm/page.tsx
import {redirect} from 'next/navigation'
import {PageShell} from '@/components/PageShell'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {safeNext} from '@/lib/safe-redirect'
import styles from '../../login/LoginForm.module.css'
import {confirmSignIn} from './actions'

export const instant = false

// Signing in needs a click: email scanners open every link in a message and would use up the token on a GET.
export default async function ConfirmPage({searchParams}: PageProps<'/auth/confirm'>) {
  const {token_hash: tokenHash, redirect_to: redirectTo} = await searchParams
  if (typeof tokenHash !== 'string' || !tokenHash) redirect('/login?error=link')

  return (
    <PageShell>
      <div className={styles.card}>
        <h1 className={styles.title}>Finish signing in</h1>
        <p className={styles.lede}>Continue to open your Vydia resources in this browser.</p>
        <form action={confirmSignIn} className={styles.form}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="next" value={safeNext(typeof redirectTo === 'string' ? redirectTo : null)} />
          <button className={cx(ui.button, ui.primary)}>Continue</button>
        </form>
      </div>
    </PageShell>
  )
}
```

```ts
// app/(site)/auth/confirm/actions.ts
'use server'
import {redirect} from 'next/navigation'
import {field} from '@/lib/form'
import {safeNext} from '@/lib/safe-redirect'
import {createClient} from '@/lib/supabase/server'

export async function confirmSignIn(form: FormData) {
  const next = safeNext(field(form, 'next'))
  const supabase = await createClient()
  const {error} = await supabase.auth.verifyOtp({type: 'email', token_hash: field(form, 'token_hash')})
  if (!error) redirect(next)
  // A double click spends the token on the first submit; the second still has a session, so let it through.
  const {data} = await supabase.auth.getClaims()
  if (data?.claims) redirect(next)
  redirect(`/login?error=link&next=${encodeURIComponent(next)}`)
}
```

`type: 'email'` covers both cases: an existing user's Magic Link email and a new user's Confirm signup email. The old `'magiclink'` and `'signup'` types are deprecated.

To skip the extra click (a plain magic link), keep a GET `route.ts` that runs the same `verifyOtp` and redirects, as the current one does. Everything else in this plan stays the same.

### 5.8 Deletions

- `app/(site)/account/update-password/` (page + form). `account` stays in `RESERVED_SLUGS`.
- `lib/supabase/client.ts`: no remaining imports after §5.4 (D21).
- `supabase/templates/reset-password.html`.
- In `tests/safe-redirect.test.ts`, change the `/account/update-password` case to any other same-site path, e.g. `/test-artist/`.

---

## 6. Email templates

Supabase sends **Magic Link** to existing users and **Confirm signup** to an email it has never seen, even when the request came from `signInWithOtp`. Both templates need the same link. The subject goes on the first line, the same convention as today.

```html
<!-- supabase/templates/magic-link.html -->
<!-- Subject: Your Welcome to Vydia sign-in link -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;font-family:'Public Sans',Helvetica,Arial,sans-serif;color:#262626;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <tr>
          <td style="background:#121212;border-radius:12px 12px 0 0;padding:24px;text-align:center;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:0.2em;">
            VYDIA
          </td>
        </tr>
        <tr>
          <td style="padding:32px 24px;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">Sign in to Welcome to Vydia</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#404040;">
              Use this button to sign in as {{ .Email }}. It works once and expires in 1 hour. Open it in the browser you
              want to stay signed in on.
            </p>
            <p style="margin:0 0 24px;">
              <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}"
                 style="display:inline-block;padding:12px 20px;background:#121212;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
                Sign in
              </a>
            </p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;">
              If you didn’t ask to sign in, you can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

`confirm-signup.html` gets the same body with subject `<!-- Subject: Your Welcome to Vydia sign-in link -->`. A first-time artist shouldn't see "confirm your account" wording. Verifying the link also confirms the email, which sets `email_confirmed_at` (the field `verifiedEmail` requires).

---

## 7. Sessions ("long, if not never-ending")

Nothing in the code changes here. The settings that give never-ending sessions, and what to keep an eye on:

| Layer | Setting | Effect |
|---|---|---|
| Supabase → Auth → Sessions | Time-box: **never**. Inactivity timeout: **never** (task 0.9) | The refresh token never expires on its own. |
| Supabase → Auth → Sessions | **Single session per user: OFF** (check this) | `creativeservices@` / `labelservices@` are shared by several people on several devices. With this on, each sign-in would kick out everyone else. |
| Supabase → Auth → Sessions | Refresh token rotation: on, reuse interval 10s (defaults) | Two tabs refreshing at the same moment don't sign each other out. |
| `@supabase/ssr` | Cookie `maxAge` = 400 days (checked in `node_modules/@supabase/ssr/dist/main/utils/constants.js`) | The longest lifetime browsers allow. |
| `proxy.ts` | `getClaims()` refreshes on every request and re-sends the cookies | The 400 days restart on every visit. In practice the session only ends after 400 days with **no visit**. |
| D21 | No browser Supabase client | Every cookie is written by a server `Set-Cookie` header, so Safari's 7-day limit on JavaScript-written cookies never applies. |

A session still ends when someone signs out, clears cookies, uses a private window, or switches browser or device. Deleting their Supabase user also ends it. Removing an email from **Allowed emails** doesn't end the session, but the page check denies them on their next load (unchanged).

---

## 8. Sanity: Website → Access

### 8.1 `sanity/schemaTypes/website.ts`

`internalViewerEmails` is already in the schema, so nothing new needs to be added. These changes make it easy to find and keep the description accurate:

```ts
export const website = defineType({
  name: 'website',
  title: 'Website (global layout)',
  type: 'document',
  icon: HomeIcon,
  groups: [
    {name: 'resources', title: 'Resources', default: true},
    {name: 'access', title: 'Access'},
  ],
  fields: [
    defineField({
      name: 'resources',
      group: 'resources',
      // …unchanged…
    }),
    defineField({
      name: 'internalViewerEmails',
      title: 'Internal viewers',
      type: 'array',
      group: 'access',
      description:
        'Vydia people who can view EVERY artist page and sign in with Google or an email link. creativeservices@ and labelservices@ always have access and don’t need to be listed. Removing someone takes effect on their next page load.',
      initialValue: ['erica.johnson@vydia.com', 'mason.omara@vydia.com'],
      // …of + validation unchanged (@vydia.com only, no duplicates)…
    }),
  ],
})
```

`initialValue` only applies when a new Website document is created (a fresh dataset). The existing document gets the emails from §8.2, or by hand in Studio.

### 8.2 `scripts/seed.ts`

```ts
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-02-19'})
const DEFAULT_INTERNAL_VIEWERS = ['erica.johnson@vydia.com', 'mason.omara@vydia.com']

async function main() {
  await client.createIfNotExists({_id: 'website', _type: 'website', resources: [], internalViewerEmails: []})

  const current = await client.fetch<string[] | null>('*[_id == "website"][0].internalViewerEmails')
  const listed = new Set((current ?? []).map((email) => email.trim().toLowerCase()))
  const missing = DEFAULT_INTERNAL_VIEWERS.filter((email) => !listed.has(email))
  if (missing.length) {
    await client.patch('website').setIfMissing({internalViewerEmails: []}).append('internalViewerEmails', missing).commit()
  }
  console.log(`Website singleton ready. Added internal viewers: ${missing.join(', ') || 'none'}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

⚠️ If Studio has an unpublished draft of Website (`drafts.website`), publishing that draft later overwrites this patch. Publish or discard the draft first. Or skip the script and add the two emails in Studio → Website → Access, then Publish. The publish webhook refreshes the cached lists either way.

### 8.3 `sanity/schemaTypes/artist.ts`

Only the description of **Allowed emails** changes:

```ts
description:
  'People who can view this page. They sign in with Google or an email link, no password. Matching ignores upper/lower case. creativeservices@vydia.com, labelservices@vydia.com, and internal viewers (Website → Access) always have access.',
```

---

## 9. Config and docs

- **`.env.example`, `.env.local`, Vercel (Preview + Production):**
  `PERMANENT_VIEWER_EMAILS=labelservices@vydia.com,creativeservices@vydia.com`
  ⚠️ The env var overrides the code default. The deployed site keeps allowing `labelrelationships@` until Vercel is updated and the site redeployed.
- **`README.md`:** the Sign-in row becomes "Google and email magic link (no passwords)". Update the `PERMANENT_VIEWER_EMAILS` row. Drop `E2E_PASSWORD` from the e2e steps (§11.2).
- **`docs/editor-guide.md`:**
  - Line 29: change `labelrelationships@` to `labelservices@`.
  - Line 36: "The first time, they enter their email and click the sign-in link we send (or use Google). No password."
  - Line 95: replace the password-confirmation note with "Ask them to check spam for an email from Vydia. Links expire after an hour, and they can request a new one on the sign-in page."
  - Add: "To give a Vydia colleague access to every page, add them under Website → Access → Internal viewers."
  - Line 5 (Sanity Studio seat) only changes if the Sanity seat moves too (§12, Q1).
- **`docs/plan.md`:** add D16–D22 to §1, mark §8.4/§8.5 as superseded by this file, update §4.3's template rows.

---

## 10. Supabase dashboard

| Where | Set to |
|---|---|
| Auth → Providers → Email | Enabled. "Confirm email" can stay on. Magic links confirm by themselves. |
| Auth → Providers → Email → Email OTP expiration | `3600` (1 hour, the default). Matches the "expires in 1 hour" wording. |
| Auth → Sign In / Providers → Allow new users to sign up | **On.** Needed for an approved artist's first link and first Google sign-in. Our allowlist is what keeps strangers out. |
| Auth → Email Templates → **Magic Link** | Subject + body from `supabase/templates/magic-link.html` |
| Auth → Email Templates → **Confirm signup** | Subject + body from `supabase/templates/confirm-signup.html` |
| Auth → Email Templates → Reset password | Leave as is. Nothing sends it any more. |
| Auth → URL Configuration → Redirect URLs | Unchanged (`http://localhost:3000/**`, `https://welcometovydia.com/**`, preview pattern). `emailRedirectTo` must match one of these, or Supabase falls back to the Site URL (which `safeNext` turns into `/`). |
| Auth → Sessions | §7 (check that single session per user is off) |
| Auth → SMTP | **Still a blocker:** Resend (U7 / task 0.12). The built-in sender only delivers to Supabase team members, 2 emails/hour. Until Resend is set up, artists can only use Google. |
| Auth → Rate limits | After Resend: raise "emails per hour" (e.g. 100). Keep the 60-second per-email limit. |
| Google Cloud → Audience | Publish the app (task 11.3) so any Google account can sign in, not only listed test users. |

Supabase's Email provider covers both passwords and magic links, and it has no switch to turn off passwords alone. Someone could still call the Supabase password sign-up API directly. They'd have to confirm an email they own, and the allowlist still applies, so it gains them nothing.

**Optional hardening (later):** a Supabase "Before User Created" auth hook that calls a new `/api/auth/allow-signup` route. The route would answer from `canSignIn`, so unapproved Google accounts never even get a user record. It's not needed for security (D20 already removes their session), so it's left out of this pass.

---

## 11. Tests

### 11.1 Unit (`tests/access.test.ts`)

```ts
beforeAll(async () => {
  process.env.PERMANENT_VIEWER_EMAILS = 'labelservices@vydia.com, CreativeServices@vydia.com'
  access = await import('@/lib/access')
})

// "always allows the permanent internal emails": LabelServices@vydia.com instead of LabelRelationships@

describe('isApprovedAnywhere', () => {
  const approved = {artistEmails: ['Jane@Example.com ', null, 'sam@example.com'], internalViewers: ['Erica.Johnson@vydia.com']}

  it('accepts any artist email, internal viewer, or permanent viewer, ignoring case and spaces', () => {
    expect(access.isApprovedAnywhere(' jane@example.COM', approved)).toBe(true)
    expect(access.isApprovedAnywhere('erica.johnson@vydia.com', approved)).toBe(true)
    expect(access.isApprovedAnywhere('labelservices@VYDIA.com', approved)).toBe(true)
  })

  it('rejects everyone else, including the old shared inbox', () => {
    expect(access.isApprovedAnywhere('eve@example.com', approved)).toBe(false)
    expect(access.isApprovedAnywhere('labelrelationships@vydia.com', approved)).toBe(false)
  })

  it('survives an empty dataset', () => {
    expect(access.isApprovedAnywhere('jane@example.com', {artistEmails: [], internalViewers: null})).toBe(false)
  })
})
```

### 11.2 E2E sign-in without passwords

`tests/e2e/global-setup.ts` gets real sessions from the Admin API's `generate_link`. That call returns the link's `hashed_token` **without sending an email**. Setup then goes through the real confirm page:

```ts
import {existsSync} from 'node:fs'
import {chromium, type FullConfig} from '@playwright/test'
import {E2E_PERSONAS, E2E_USERS, storageStatePath} from './users'

async function hashedToken(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({type: 'magiclink', email}),
  })
  if (!response.ok) throw new Error(`generate_link for ${email}: ${response.status} ${await response.text()}`)
  const {hashed_token: token}: {hashed_token: string} = await response.json()
  return token
}

export default async function globalSetup(config: FullConfig) {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local')
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000'
  const extraHTTPHeaders = config.projects[0]?.use.extraHTTPHeaders
  const browser = await chromium.launch()
  for (const persona of E2E_PERSONAS) {
    const context = await browser.newContext({baseURL, extraHTTPHeaders})
    const page = await context.newPage()
    await page.goto(`/auth/confirm?token_hash=${await hashedToken(E2E_USERS[persona])}&type=email&redirect_to=/`)
    await page.getByRole('button', {name: 'Continue'}).click()
    await page.waitForURL((url) => url.pathname === '/', {timeout: 30_000})
    await context.storageState({path: storageStatePath(persona)})
    await context.close()
  }
  await browser.close()
}
```

Other changes:
- `tests/e2e/users.ts`: delete `e2ePassword()`.
- `scripts/e2e-fixtures.ts`: `upsertUser(email)` posts `{email, email_confirm: true}` with no password, and skips users that already exist.
- `.github/workflows/e2e-preview.yml`: delete the `E2E_PASSWORD` step. The job already has `SUPABASE_SERVICE_ROLE_KEY`.
- `README.md` e2e steps: drop the `export E2E_PASSWORD=…` line. Local `npm run e2e` now needs `SUPABASE_SERVICE_ROLE_KEY`, just like `e2e:setup` already did.

### 11.3 New `tests/e2e/sign-in.spec.ts`

None of these send a real email: they only use addresses that aren't approved, so `after()` does nothing.

```ts
import {expect, test} from '@playwright/test'
import {E2E_USERS} from './users'

test.describe('sign-in page', () => {
  test('offers Google and an email link, and no password', async ({page}) => {
    await page.goto('/login?next=%2Ftest-artist')
    await expect(page.getByRole('button', {name: 'Continue with Google'})).toBeVisible()
    await expect(page.getByRole('button', {name: 'Email me a sign-in link'})).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('a known-but-unapproved and a made-up email get the same answer', async ({page}) => {
    const answers: string[] = []
    for (const email of [E2E_USERS.outsider, `nobody-${Date.now()}@example.com`]) {
      await page.goto('/login')
      await page.getByPlaceholder('Email').fill(email)
      await page.getByRole('button', {name: 'Email me a sign-in link'}).click()
      const status = page.getByRole('status')
      await expect(status).toContainText(email)
      answers.push(((await status.textContent()) ?? '').replace(email, '<email>'))
    }
    expect(answers[0]).toBe(answers[1])
    await expect(page.getByRole('button', {name: /^Resend link in \d+s$/})).toBeDisabled()
  })

  test('"Use a different email" starts over', async ({page}) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(`nobody-${Date.now()}@example.com`)
    await page.getByRole('button', {name: 'Email me a sign-in link'}).click()
    await page.getByRole('button', {name: 'Use a different email'}).click()
    await expect(page.getByPlaceholder('Email')).toHaveValue('')
  })

  test('Google goes to accounts.google.com via Supabase', async ({page}) => {
    await page.goto('/login?next=%2Ftest-artist')
    const google = page.waitForRequest((request) => request.url().startsWith('https://accounts.google.com/'))
    await page.getByRole('button', {name: 'Continue with Google'}).click()
    expect((await google).url()).toContain('prompt=select_account')
  })

  test('a bad or used link asks for a new one', async ({page}) => {
    await page.goto('/auth/confirm?token_hash=not-a-real-token&type=email&redirect_to=/test-artist')
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page).toHaveURL('/login?error=link&next=%2Ftest-artist')
    await expect(page.locator('p[role="alert"]')).toContainText('invalid, expired, or already used')
  })

  test('opening a link does not sign in until Continue is pressed', async ({page, request}) => {
    const response = await request.get('/auth/confirm?token_hash=anything&type=email', {maxRedirects: 0})
    expect(response.status()).toBe(200)
    expect(response.headers()['set-cookie'] ?? '').not.toContain('sb-')
  })
})
```

`tests/e2e/a11y.spec.ts`: replace "login page, all three modes" with checks of the sign-in page (with `?error=link`), the "Check your email" state (made-up address), and `/auth/confirm?token_hash=x`.

### 11.4 Manual QA (replaces task 7.11)

Run on a preview deployment once Resend is set up:

- [ ] Approved artist email → link arrives (from Resend, with branding) → Continue → lands on their page.
- [ ] First-ever sign-in for a new approved email: the Confirm signup template arrives with sign-in wording and works the same way.
- [ ] Unapproved email → same screen, no email arrives, no user appears in Supabase → Users.
- [ ] Outlook / Microsoft 365 recipient: the link still works after the message has sat in the inbox for a minute (scanner check).
- [ ] Open the link on a phone in the Gmail app → signed in inside that browser. Then confirm the email text tells people where to open it.
- [ ] Resend shows a countdown, and works after 60 seconds.
- [ ] Google, approved account → returns to `next`. Unapproved account → `/login` with the not-approved message, and no session cookie.
- [ ] `erica.johnson@` / `mason.omara@` (Google or link) can open any artist page. Removing one from Internal viewers and publishing → "This page isn't available" on their next load.
- [ ] `labelservices@` and `creativeservices@` can open any artist page. `labelrelationships@` can't (after the Vercel env update).
- [ ] Close and reopen the browser a few days later → still signed in, no prompt. Safari included.

---

## 12. Open questions

1. **The Sanity seat.** The shared Studio login (Sanity member) is `labelrelationships@vydia.com` (main plan 0.4, editor guide line 5). Does that seat move to `labelservices@` too, or does only viewer access change? This plan only changes viewer access.
2. **Does the `labelservices@vydia.com` inbox exist and receive mail?** With passwords gone, the email link is that inbox's only way in besides Google.
3. **Link lifetime.** 1 hour is Supabase's default and the safer choice. If artists often open the email the next day, it can go up to 24 hours (`86400`), and the email copy changes to match.
4. **Bot protection.** Supabase can require a captcha (Cloudflare Turnstile) on `signInWithOtp`. It's not needed at launch, because unapproved emails cost nothing and approved ones are rate-limited per address. Worth adding if the logs show abuse.

---

## 13. To-do list

### Phase A: Prep (dashboards, no deploy needed)
- [ ] **A.1** ⏳ *Needs you (Supabase dashboard).* Paste the new **Magic Link** and **Confirm signup** templates into Supabase (§6). Safe to do before the code ships: the current GET `/auth/confirm` already handles `type=email`.
- [ ] **A.2** ⏳ *Needs you (Supabase dashboard; not exposed by the public settings API).* Check Auth → Sessions (§7), especially single session per user = off.
- [x] **A.3** Studio → Website → add `erica.johnson@vydia.com` and `mason.omara@vydia.com` to Internal viewers → Publish (or run §8.2 after deploying the schema change).
  ✅ 2026-10-21: ran `npx sanity exec scripts/seed.ts --with-user-token` against `production` (no `drafts.website` existed). Both emails are on the published Website. A second run added nothing.
- [ ] **A.4** ⏳ *Needs you.* Answer §12 Q1–Q2.
- [ ] **A.5** ⏳ *Needs you (Resend approval + DNS).* Resend + Supabase SMTP (existing U7). This blocks email sign-in for artists, but not the code work.

### Phase B: Code
- [x] **B.1** `APPROVED_EMAILS_QUERY` + `npm run typegen` (§4.1).
- [x] **B.2** `lib/access.ts`: permanent default, `isApprovedAnywhere`, `canSignIn` + unit tests (§4.2, §11.1).
- [x] **B.3** `lib/form.ts`, `lib/supabase/stateless.ts` (§5.1–5.2).
- [x] **B.4** Login actions, form, errors, page, CSS (§5.3–5.5).
- [x] **B.5** `/auth/callback` rejects unapproved Google accounts (§5.6).
- [x] **B.6** `/auth/confirm` page + action, delete `route.ts` (§5.7).
- [x] **B.7** Deletions (§5.8).
- [x] **B.8** Templates in the repo (§6).
- [x] **B.9** Website/artist schema changes + seed script (§8).
- [x] **B.10** `.env.example`, README, editor guide, main plan (§9).
- [x] **B.11** E2E: global setup, fixtures, workflow, new spec, a11y updates (§11.2–11.3).
- [x] **B.12** `npm run lint && npm run typecheck && npm run test && npm run format:check`, then `npm run e2e` locally.
  ✅ 2026-10-21: lint, typecheck, and 70/70 unit tests pass. `format:check` flags only files that already failed before this work (`app/manifest.json`, five component CSS modules, `components/PageShell.tsx`, `TASKS.md`). `npm run build` passes.
  E2E (production build, local Supabase + Sanity): **17 passed, 6 failed**. All 6 sign-in tests pass, global setup signs in through `generate_link` + the Continue page, and the "Finish signing in" page passes axe. Running the same tests against the unmodified `HEAD` build showed the 6 failures were already there, from the `style` branch's redesign:
  - `color-contrast` on `/`, the no-access notice, and the sign-in page's `.error` / `.divider`: `--color-text-muted` (#6b7280) and `--color-danger` (#dc2626) are too dim on the new `#1a1a1a` background. (The new `.lede` uses the base text color and passes.)
  - "sees the resource cards" and "keyboard only": `getByRole('region', {name: 'Resources'})` isn't found with the carousel view. Fails on the baseline too.
  - "the video dialog … returns focus": flaky on both builds (1–3 of 4 runs fail).

### Phase C: Ship
- [ ] **C.1** ⏳ *Needs your go-ahead: changes production access the moment it's saved.* Vercel: `PERMANENT_VIEWER_EMAILS=labelservices@vydia.com,creativeservices@vydia.com` for Preview + Production.
- [ ] **C.2** ⏳ *Needs your go-ahead.* The work is uncommitted on `style`, which also holds unrelated in-progress UI commits. Decide whether it ships with them or on its own branch. Open the PR. CI passes, and e2e passes against the preview.
- [ ] **C.3** ⏳ *Needs a person with real inboxes (after A.1 and A.5).* Manual QA on the preview (§11.4).
- [ ] **C.4** ⏳ *Needs your go-ahead (production deploy).* Merge → production. Repeat the Google and link checks on `welcometovydia.com`.
- [ ] **C.5** ⏳ *Needs you.* Record a short Loom addendum for L&A: "clients no longer create a password", and how to add a colleague as an internal viewer.

**Done when:** an approved artist can open their page via Google or one email link without ever choosing a password; an unapproved email or Google account never ends up with a session; the four Vydia addresses can open every page; and a returning visitor is never asked to sign in again unless they cleared their cookies.
