# eLeague Manager — How This Project Works

A PWA tournament manager for eFootball leagues, live at [league.getgol.in](https://league.getgol.in). Players register, get approved, get placed into groups, play round-robin matches, then move into a knockout bracket to a winner. Admins run the whole thing from a Google-authenticated panel.

## Stack

- **Frontend**: vanilla JS (ES modules), no framework, no build step. Static HTML/CSS/JS served directly.
- **Backend**: Firebase — Firestore (database), Firebase Auth (Google sign-in for admins), Firebase Hosting is *not* used for the app itself (see Hosting below).
- **Hosting**: GitHub Pages, repo `Surajprem7/eleague-manager`, served at the custom domain `league.getgol.in` via Cloudflare DNS (grey-cloud / DNS-only, no proxying).
- **PWA**: installable, with a service worker (`sw.js`) for offline asset caching.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Player-facing app: registration, live matches, standings, bracket link |
| `admin.html` | Admin panel, gated behind Google sign-in |
| `bracket.html` | Shareable knockout bracket view (canvas image export) |
| `stats.html` | Player stats and top-scorer leaderboard |

## Data model (Firestore collections)

- **`players`** — `{ name, efootballId, phone, status: pending|approved|rejected, group, registeredAt }`. Anyone can create (self-registration); only admins can update/delete. Creation is schema-validated server-side (`firestore.rules`).
- **`groups`** — `{ letter, players: [playerId, ...] }`. Admin-only write.
- **`matches`** — `{ phase: group|r32|r16|qf|sf|3rd|final, group?, homeId, awayId, homeName, awayName, homeScore, awayScore, status: scheduled|live|completed, joinCode, scheduledAt, winner }`. Admin-only write.
- **`tournament`** — single status doc admins update as the event progresses.
- **`admins`** — `{ email, addedAt }`, doc ID is the email with non-alphanumeric characters replaced by `_` (e.g. `surajtxglive_gmail_com`). Read/write gated to existing admins.
- **`disputes`** — `{ matchId, playerName, reason, status: open|resolved, resolution, createdAt, resolvedAt }`. Anyone can raise; only admins resolve.
- **`activity_log`** — append-only audit trail of every admin action. Anyone can create (so dispute-raising can log itself), only admins can read or delete.

## How admin access works

There's no separate "admin" auth system — any Google account can sign in, but `js/auth.js`'s `onAdminAuth()` only treats a signed-in user as an admin if their email exists in the `admins` collection. The check happens twice, independently:

1. **Client-side** (`isAdminEmail()` in `js/auth.js`): reads the whole `admins` collection and checks membership, to decide whether to show the admin UI.
2. **Server-side** (`isAdmin()` in `firestore.rules`): uses `exists()` to check for a document at `admins/{sanitizedEmail}` before allowing any admin-only write. This is what actually protects the data — the client-side check is just UX, not security.

To add a new admin: sign in as an existing admin → Admins tab → enter their Gmail. To remove one: same tab, minus removing yourself (blocked both client- and server-side).

## Auth flow specifics

Google sign-in uses `signInWithPopup`, **not** `signInWithRedirect`. This matters: the app is hosted on a custom domain (`league.getgol.in`) while Firebase's `authDomain` is the default `eleague-manager.firebaseapp.com`. Redirect-based sign-in relies on a same-site relay between those two origins, which modern Chrome's storage partitioning breaks — `getRedirectResult()` silently returns `null` after the redirect completes. Popup-based sign-in doesn't have this problem, so don't switch this back to redirect without solving the cross-origin storage issue first (e.g. by serving the app through Firebase Hosting with a custom domain, which lets `authDomain` match the app's own domain).

## Tournament flow (`js/tournament.js`, `js/admin.js`)

1. **Registration** (`registerPlayer` in `app.js`) — players self-register, status `pending`.
2. **Approval** (`updatePlayerStatus` in `admin.js`) — admin approves/rejects.
3. **Grouping** (`saveGroupsAndGenerateMatches`) — admin assigns approved players into groups; this auto-generates round-robin matches per group via `generateGroupMatches`.
4. **Group stage** — admin sets matches live (`setMatchLive`, capped at 2 concurrent live matches) and enters scores (`enterScore`). Standings are computed on the fly by `computeStandings` (3 pts win / 1 pt draw, tiebreak: points → goal difference → goals for).
5. **Knockout generation** (`checkAndGenerateKnockout`) — once all group matches are completed, top finishers per group (`getQualifiers`) are pulled into a knockout bracket (`generateKnockoutRound`).
6. **Knockout progression** (`advanceKnockout`) — as each round completes, winners advance to the next round; the `3rd`-place round is handled separately from the semifinal losers.
7. **Winner** — final match completion triggers the winner announcement flow (`notify.js`'s `generateWinnerAlert`, used for WhatsApp share text).

Live match updates, standings, and the bracket are pushed to the UI via Firestore's real-time listeners (`js/realtime.js`), not polling.

## Deployment

- **App code**: any push to `main` redeploys automatically via GitHub Pages — no build step, files are served as-is.
- **Firestore rules** (`firestore.rules`): **not** deployed by GitHub Pages. Must be deployed separately with the Firebase CLI:
  ```
  firebase deploy --only firestore:rules
  ```
  (`.firebaserc` / `firebase.json` in this repo are already configured for the `eleague-manager` project — just run the command above after editing rules.)
- **Service worker cache**: `sw.js`'s `CACHE` constant must be bumped (e.g. `eleague-v6` → `eleague-v7`) any time a cached file changes, otherwise returning visitors keep serving stale JS/CSS until the cache naturally expires. A hard refresh (Ctrl+Shift+R) forces an immediate update for testing.

## Known gotchas (learned the hard way)

- **Browser HTTP caching can outlast a deploy.** After pushing a fix, the live site may serve stale JS even though `curl` shows the new file — this is the browser's disk cache for `<script type="module">` requests, separate from the service worker. A hard refresh resolves it; this is why `sw.js`'s cache version exists as a forcing function for *returning* visitors.
- **A Firebase API key can simply stop working** with `auth/api-key-not-valid` even when every visible setting (key value, API restrictions, enabled APIs, org policies) checks out. If this happens again, the fastest fix is generating a brand-new key (Google Cloud Console → APIs & Services → Credentials → Create credentials → API key), scoping it to Identity Toolkit API + Token Service API + Cloud Firestore API, and swapping it into `js/firebase.js` — don't burn time re-checking the same restriction screens.
- **GitHub Pages can't set custom HTTP headers**, so there's no way to force cache invalidation server-side; the service worker's cache-version bump is the only lever available.
