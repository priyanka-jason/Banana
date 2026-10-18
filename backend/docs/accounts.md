# Accounts: sign in with Google or Apple, and saved shopping lists

**Status: backend built and tested, not switched on yet.** Signing in needs the setup steps
below in Google, Apple and Supabase, which only the team can do. Saved lists are kept in
memory on the local API for now (lost when it stops) until the Supabase version is written.

## How it fits together

1. The website shows **Sign in with Google** and **Sign in with Apple** buttons.
2. Supabase Auth does the whole sign-in with Google or Apple. We never see a password.
   Supabase creates the person's account (a row in `auth.users`) the first time.
3. Supabase gives the browser a **login token**: signed text saying which user this is,
   valid for about an hour. Supabase's library renews it automatically.
4. For personal things, the website calls our API with `Authorization: Bearer <login token>`.
   The API checks the signature against Supabase's public keys, so a token can't be made up
   or edited, and then only ever touches that person's own lists.
5. Saved lists live in `banana.shopping_lists` and `banana.shopping_list_items`
   (`backend/sql/accounts-setup.sql`), locked so each row is visible only to its owner.
   Deleting an account deletes its lists.

Search, prices and stores work the same signed in or not.

## Setup (team, one time)

Never put a secret in chat, in GitHub or in the website's code. Client secrets and keys go
straight into the Supabase dashboard.

1. **Database.** Run `backend/sql/accounts-setup.sql` in the Supabase SQL Editor, after
   `supabase-setup.sql`. It only adds two tables. Tested on Postgres 17 with fake users: a second
   person could not see, change, delete or add to the first person's lists, and the public key got nothing.
2. **Google (free).** In Google Cloud Console: set up the OAuth consent screen (app name "Banana"),
   then Credentials → Create credentials → OAuth client ID → Web application. Authorized redirect URI:
   `https://wkqxnxjsvrnnpikibrfh.supabase.co/auth/v1/callback`. Paste the client ID and secret into
   Supabase → Authentication → Sign In / Providers → Google, and switch it on.
3. **Apple (needs the paid Apple Developer Program, US$99/year).** Create an App ID with Sign in with
   Apple, a Services ID (the web client ID) with domain `wkqxnxjsvrnnpikibrfh.supabase.co` and return URL
   `https://wkqxnxjsvrnnpikibrfh.supabase.co/auth/v1/callback`, and a Sign in with Apple key (`.p8`, Key ID,
   Team ID). Fill those into Supabase → Authentication → Sign In / Providers → Apple. Apple's secret expires
   after at most 6 months, so set a reminder to renew it. Without the membership, launch with Google only;
   nothing in the backend changes.
4. **Allowed addresses.** Supabase → Authentication → URL Configuration: Site URL = the live website;
   Redirect URLs = `http://127.0.0.1:5173/**` and the live address with `/**`.
5. **Local API.** In `backend/.env` (never committed) set
   `SUPABASE_URL=https://wkqxnxjsvrnnpikibrfh.supabase.co`. That is all the API needs to check login
   tokens. `npm run api` then prints "Accounts are on". Without it, `/api/lists` answers 503.

## For the website (frontend)

Install `@supabase/supabase-js` in `frontend/` and make one client with the project URL and the
**anon** key (safe in a browser; never the service role key):

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
export const signInWithApple = () =>
  supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } })
export const signOut = () => supabase.auth.signOut()

/** Calls our API for personal things, with the login token. */
export async function apiWithLogin(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return fetch(path, {
    ...init,
    headers: { ...init.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
}
```

Use `supabase.auth.onAuthStateChange(...)` to switch between "Sign in" and the person's lists.

## Endpoints

All need `Authorization: Bearer <login token>`. Missing, expired or made-up token: `401 unauthorized`
(sign in again). Server without accounts switched on: `503 unavailable`. Someone else's list always
looks like it doesn't exist: `404`.

| Method | Path | What it does |
|---|---|---|
| GET | `/api/lists` | Your lists, newest change first: `{ lists: [{ id, name, itemCount, updatedAt }] }` |
| POST | `/api/lists` | Create `{ name, items? }`. Answers `201` with the list. At most 50 lists. |
| GET | `/api/lists/{id}` | One list: `{ id, name, items, createdAt, updatedAt }` |
| PUT | `/api/lists/{id}` | Replace the name and every entry: `{ name, items }` |
| DELETE | `/api/lists/{id}` | Delete it: `{ deleted: true }` |
| POST | `/api/lists/{id}/prices` | What it costs: the same answer as `POST /api/prices/list`. The body says where to shop (`chainSlugs`, `locationIds`, `near`, `memberPricing`, `matchesPerItem`), without `items`. |

`items` are the same entries as `POST /api/prices/list`: `{ "query": "milk", "quantity": 2 }`
(optionally with `categories`) or `{ "itemId": "walmart:sim-bananas" }`. Up to 50 per list,
quantity 1 to 99, name 1 to 100 characters. A location sent to `/prices` is used for that answer
only: never saved with the list, never logged.

## Not built yet

- Keeping lists in Supabase instead of memory (the tables exist once the SQL is run).
- Deleting your own account from the website.
- The sign-in screen in the website (frontend).
