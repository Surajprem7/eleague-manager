# eLeague Manager — Project Status

Last updated: June 2026 | App version: `v34` | Branch: `main`

Live at [league.getgol.in](https://league.getgol.in) — deployed automatically via GitHub Pages on every push to `main`.

---

## What This Project Is

A Progressive Web App (PWA) for managing eFootball (EA Sports FC) tournaments. Covers the full lifecycle: player self-registration → admin approval → group draw → round-robin group stage → knockout bracket → champion announcement. Players use `index.html`; admins use a Google-authenticated `admin.html` panel.

| Page | URL |
|---|---|
| Player app | https://league.getgol.in |
| Admin panel | https://league.getgol.in/admin.html |
| Stats / leaderboard | https://league.getgol.in/stats.html |
| Knockout bracket | https://league.getgol.in/bracket.html |

Default admin email: `surajtxglive@gmail.com`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES modules), HTML5, CSS3 — no framework, no build step |
| Database | Firebase Firestore (NoSQL, real-time via `onSnapshot`) |
| Auth | Firebase Authentication — Google sign-in (admin only, popup-based) |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Hosting | GitHub Pages + Cloudflare DNS (grey-cloud / DNS-only, no proxying) |
| Match reminders | Separate Cloudflare Worker (`eleague-notifier`), cron every 2 min |
| Firebase project | `eleague-manager` (Spark / free tier — no Cloud Functions, no Storage) |
| PWA | Service worker (`sw.js`, cache key `eleague-v34`), installable on Android + iOS |

---

## File Structure

```
eleague-manager/
├── index.html              Player app
├── admin.html              Admin panel
├── bracket.html            Shareable knockout bracket
├── stats.html              Leaderboard & player stats
├── manifest.json           PWA config (name: "eLeague Manager", theme: #1D9E75)
├── sw.js                   Service worker (cache: eleague-v34)
├── firestore.rules         Firestore security rules
├── firebase.json           Firebase CLI config
├── .firebaserc             Firebase project mapping
├── CNAME                   Custom domain: league.getgol.in
├── PROJECT.md              Architecture & data model reference
├── ADMIN_GUIDE.md          Step-by-step admin guide
├── PROJECT_STATUS.md       This file
├── css/
│   ├── style.css           Player app styles
│   └── admin.css           Admin styles
├── js/
│   ├── firebase.js         Firebase init & API key
│   ├── auth.js             Google login, admin gating, default-admin governance
│   ├── app.js              Core player flows (register, verify, score reporting)
│   ├── admin.js            Admin operations (approval, groups, scores, disputes)
│   ├── tournament.js       Standings computation, bracket generation, knockout logic
│   ├── matches.js          Match utilities (join code, score submission)
│   ├── realtime.js         Firestore real-time listeners (onSnapshot)
│   ├── push.js             FCM token registration & notification opt-in
│   ├── stats.js            Stats & leaderboard
│   ├── dispute.js          Dispute submission
│   ├── activitylog.js      Admin audit trail
│   └── notify.js           Winner announcement / WhatsApp share text
└── assets/
    ├── banner.png
    ├── intro.mp4
    ├── instructions.mp4
    ├── icon-192.png
    └── icon-512.png
```

---

## Firestore Data Model

| Collection | Fields |
|---|---|
| `players` | `name, efootballId, phone, status (pending/approved/rejected), group, registeredAt, appVersion, appVersionAt, fcmToken, fcmTokenAt` |
| `groups` | `letter, players: [ids...]` |
| `matches` | `phase (group/r32/r16/qf/sf/3rd/final), group?, homeId, awayId, homeName, awayName, homeScore, awayScore, status (scheduled/live/completed), joinCode, scheduledAt, winner, homeTeamSetup, awayTeamSetup, homeReportH, homeReportA, awayReportH, awayReportA, scoreMismatch, notified10Min` |
| `tournament` | `phase (registration/group/knockout/done), winner, second, third` |
| `admins` | `email, addedAt, isDefault` — doc ID = email with non-alphanumerics replaced by `_` |
| `disputes` | `matchId, playerName, reason, status (open/resolved), resolution, createdAt, resolvedAt` |
| `activity_log` | `type, message, meta, timestamp` |

---

## Features Built

### Player App (`index.html`)

- Self-registration: unique name (case-insensitive) + unique eFootball ID + optional phone
- "Already registered? Verify here" for returning players on new/cleared devices — matches on name + phone OR eFootball ID (either)
- "Not you? Switch account" reset link for shared devices
- Device profile recognition via `localStorage` (`myRegisteredName` flag)
- `myRegisteredName` flag retroactively set when finding yourself via My Matches (catches pre-feature registrations)
- Bottom nav hides irrelevant tabs until player is recognized on device
- Home becomes a personal dashboard once recognized: profile card, group rank, next match, full schedule
- Live match ticker (real-time), next match preview, tournament phase display
- Intro video overlay — auto-plays muted on load, skippable, non-blocking on error
- Instructions video accessible via play button on home banner
- Share button on banner (native share sheet → intro video + join link; fallbacks to text/clipboard)
- iOS "Add to Home Screen" dismissible banner shown at startup (doesn't overlap update banner)
- Android/Edge install prompt via `beforeinstallprompt`; iOS shows manual tap-share hint
- "Update available" one-tap reload banner when new service worker takes over
- Tournament champion announcement page when phase = `done`
- **Score submission from My Matches**: both players report independently
  - If both agree → match auto-completes (Firestore rule enforces the transition)
  - If they disagree → `scoreMismatch` flagged, both players see "not matching" message, admin resolves
- Team/manager setup submission after confirming ready on Join tab
- Push notification opt-in ("Enable" button on My Matches) — saves FCM token to Firestore
- Standings tab: group-by-group, tiebreakers (Points → GD → GF), top 2 qualified marked
- Dispute tab: flag wrong results (match ID + reason)
- In-app Help modal: step-by-step guide (register → confirm → play → report → standings → notifications)

### Admin Panel (`admin.html`)

- Google sign-in (popup-based — see Gotchas)
- Default-admin governance: `surajtxglive@gmail.com` is permanent; only default admin can add/remove others; max 3 admins; other admins cannot see default admin in the list (enforced in both `auth.js` and `firestore.rules`)
- **Players tab**: approve/reject registrations; see eFootball ID, phone, group; green "Latest" / red "Outdated" app version badge per player
- **Groups tab**: drag-and-drop assignment; "Save & Generate Schedule" auto-generates full round-robin per group
- **Matches tab**: Set Live (max 2 concurrent enforced); Schedule with date/time (triggers push reminders); Enter Score; view team setups; see score mismatches with both submitted scores; status badges
- **Knockout tab**: same as Matches; winners auto-advance; 3rd place match generated from SF losers
- **Results tab**: all completed matches, score override
- **Disputes tab**: resolve with admin notes
- **Activity Log tab**: append-only audit trail of all admin actions with timestamps
- **Admins tab** (default admin only): add/remove up to 3 total
- **In-app Help tab**: full match-day guide inline

### Stats Page (`stats.html`)
W/D/L, goals for/against, win rate, match history per player, top scorers leaderboard, knockout stage reached

### Bracket Page (`bracket.html`)
Shareable knockout bracket view, canvas image export

---

## Tournament Flow (End-to-End)

1. **Registration phase** — players self-register, status `pending`
2. Admin approves players in Players tab
3. Admin assigns groups (drag-and-drop) → "Save & Generate Schedule" → full round-robin auto-generated
4. **Group stage** — admin sets match live (max 2 at once), shares join code via WhatsApp; players confirm ready + submit team setup; players enter final score themselves → auto-completes or flags mismatch
5. **Knockout auto-generated** once all group matches done — top finishers pulled into bracket (R32/R16/QF/SF/3rd/Final depending on player count)
6. **Knockout** — same flow as group stage, winners auto-advance
7. Final completed → winner announced on player app, WhatsApp share text generated

---

## Push Notification Architecture

**Client side** (`js/push.js`):
- Requests permission, gets FCM token via VAPID key
- Saves `fcmToken` + `fcmTokenAt` to player's own Firestore doc (narrowly-scoped write rule)
- Background message handler merged into `sw.js`

**Trigger side** (separate repo: `C:\Users\User\Documents\eleague-notifier`):
- Cloudflare Worker with cron trigger every 2 minutes
- Finds matches with `scheduledAt` in next ~11 minutes that haven't been notified (`notified10Min` not set)
- Authenticates to Firestore + FCM HTTP v1 API via Firebase service-account JWT — implemented manually with Web Crypto (Workers can't use Node's `google-auth-library`)
- Sends push to each player's `fcmToken`, marks match `notified10Min: true`
- Manual test: `https://eleague-notifier.<account>.workers.dev/?key=<TEST_KEY>` returns `{checked, notified, errors}`
- Credentials stored only as Cloudflare Worker secrets (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — never committed; downloaded JSON key deleted after setup

**Why not Firebase Cloud Functions**: requires paid Blaze plan; this project stays on free Spark tier.

---

## Security Model

### Two independent auth layers (both must agree)
1. **Client-side** `isAdminEmail()` in `auth.js` — reads `admins` collection, gates UI (UX only, not security)
2. **Server-side** `isAdmin()` in `firestore.rules` — `exists()` check before any admin write (the actual security boundary)

### What non-admins can write (narrowly scoped via `firestore.rules`)
| Collection | Allowed writes |
|---|---|
| `players` | Own doc only: `fcmToken`, `fcmTokenAt`, `appVersion`, `appVersionAt` |
| `matches` | Own match only: `homeTeamSetup`/`awayTeamSetup`, score report fields (`homeReportH/A`, `awayReportH/A`), and the auto-finalize transition (official score/status/winner) only when both reports agree |
| `disputes` | Create only (anyone can raise) |
| `activity_log` | Create only (for self-logging dispute submissions) |

---

## Bugs Fixed (Full History)

### Identity & Player Recognition

| Bug | File(s) Changed | Fix |
|---|---|---|
| **Identity hijack in My Matches search** — searching any player's name overwrote the device's `myRegisteredName` flag, app-version report, and notification target to whoever was searched | `js/app.js` | Identity flag set only on first lookup (when none exists); app-version reporting and notification prompt only fire when search matches the already-known device identity |
| **Returning players on new/cleared devices had no path to re-link** — could only stumble into My Matches search | `index.html`, `js/app.js` | Added "Already registered? Verify here" on Register tab with name + eFootball ID re-link flow |
| **Verification only accepted eFootball ID** — locked out players who registered without memorizing their ID | `js/app.js` | Verification now accepts name + phone OR eFootball ID |
| **`myRegisteredName` flag never set retroactively** — players who registered before this feature existed saw the registration form again on same device | `js/app.js` | Finding yourself via My Matches search also sets the flag |
| **Registration form showed for already-registered players** on same device | `index.html`, `js/app.js` | `myRegisteredName` localStorage flag added; form hidden for recognized players; falls back gracefully if lookup fails or record deleted |
| **No profile shown for recognized players** — just a static "you're registered" sentence | `index.html`, `js/app.js` | Recognized players now see a real profile card (name, eFootball ID, phone, group, status badge) |
| **No path to re-link from Register tab** — only via My Matches search | `index.html`, `js/app.js` | Explicit "Already registered? Verify here" link added to Register tab |

### Security & Auth

| Bug | File(s) Changed | Fix |
|---|---|---|
| **Firebase API key stopped working** (`auth/api-key-not-valid`) with no obvious cause | `js/firebase.js` | Generated a new API key scoped to Identity Toolkit + Token Service + Cloud Firestore APIs |
| **Google sign-in redirect broken** — `getRedirectResult()` returned `null` silently due to Chrome cross-origin storage partitioning (custom domain vs Firebase `authDomain`) | `js/auth.js` | Switched to `signInWithPopup`; documented to never switch back without solving the cross-origin issue |
| **Google sign-in popup errors swallowed silently** — `loginWithGoogle()` returned `null` on failure with no feedback | `js/auth.js` | Now throws a friendly `Error` for real failures (popup blocked, in-app browser issues), surfaced via toast |
| **Admin collection read broken under new privacy rules** — `isAdminEmail()` did a full collection scan, which the default-admin privacy filter would break | `js/auth.js` | Switched to single-document `get()` instead of collection scan |
| **Default admin could be removed** — no governance model existed | `js/auth.js`, `firestore.rules` | Default admin (`surajtxglive@gmail.com`) hardcoded as permanent in both layers; only default admin can add/remove others; max 3 admins total; other admins cannot see default admin in list |
| **`setup-admin.html` exposed in public repo** — utility page for bootstrapping admin access | (file deleted) | Removed from repository entirely |
| **Critical security/audit findings** — discovered during a full security audit | `firestore.rules`, multiple `js/` files | Fixed across commits `e63cefb` and `49a5a97` |
| **Minor follow-up audit findings** | `firestore.rules`, `js/` files | Fixed in `cf63ff7` |
| **Dead `isSuper`/`Owner` badge UI** — field was never set by any code, dead markup remained | `admin.html`, `js/admin.js` | Removed dead badge elements |

### Data Integrity

| Bug | File(s) Changed | Fix |
|---|---|---|
| **Duplicate player names allowed** — multiple flows look up players by exact name, taking first result; two same-named players would collide | `js/app.js` | Registration blocks duplicate names (case-insensitive) the same way it blocks duplicate eFootball IDs |

### UX & PWA

| Bug | File(s) Changed | Fix |
|---|---|---|
| **iOS "Add to Home Screen" banner never seen** — only shown when user tapped the instructions video play button | `index.html`, `js/app.js` | Now shows as a standalone dismissible banner on page load (iOS Safari, not already installed) |
| **Stale cached code in installed PWAs/open tabs** — users wouldn't know a new version existed | `sw.js`, `index.html`, `js/app.js` | App detects new service worker takeover via `statechange` + `controllerchange` events; shows "Update available" one-tap reload banner |
| **Browser HTTP caching outlasts deploys** — stale JS served after push even though `curl` shows new file | `sw.js` | Service worker cache version bump (`eleague-vN`) forces refresh for returning visitors; documented: hard-refresh resolves for immediate testing |

---

## Deliberate Architecture Decisions

| Decision | Why |
|---|---|
| No framework (vanilla JS) | No build step = simple GitHub Pages deploy; fast loads; no dependency churn |
| No Firebase Cloud Functions | Requires paid Blaze plan; free Spark tier used; push trigger moved to Cloudflare Worker |
| No Firebase Hosting | GitHub Pages + Cloudflare DNS is simpler and free; no server-side logic needed |
| No Firebase Storage for screenshots | Would require Blaze plan; screenshot disputes handled via WhatsApp instead |
| `signInWithPopup` not `signInWithRedirect` | Redirect sign-in broken by Chrome cross-origin storage partitioning between custom domain and Firebase authDomain |
| Player-side score reporting + auto-finalize | Reduces admin workload — admin only intervenes on mismatches |
| Two independent auth layers (client + Firestore rules) | Client-side is UX only; rules are the actual security boundary — both independently enforce access |
| Service-account JWT built manually with Web Crypto | Cloudflare Workers can't use Node's `google-auth-library` |
| Default admin hardcoded in both `auth.js` and `firestore.rules` | Governance can't be bypassed even if one layer is edited |

---

## Deployment

| What | How |
|---|---|
| App code | Push to `main` → GitHub Pages auto-deploys (no build step) |
| Firestore rules | `firebase deploy --only firestore:rules` — manual, not touched by GitHub Pages |
| New version rollout | Bump `CACHE` constant in `sw.js` (e.g. `eleague-v34` → `eleague-v35`) before pushing |
| Push notification Worker | `cd eleague-notifier && export CLOUDFLARE_API_TOKEN=<token> && npx wrangler deploy` |

---

## Known Gotchas (Learned the Hard Way)

1. **Browser HTTP caching outlasts deploys** — GitHub Pages can't set custom HTTP headers; service worker cache version bump is the only lever
2. **Firebase API key can randomly stop working** — generate a new one scoped to the right APIs; don't troubleshoot the same restriction screens
3. **Redirect sign-in is broken** — always use `signInWithPopup`; do not switch back without solving the cross-origin storage partitioning issue
4. **Firestore rules must be manually deployed** — `firebase deploy --only firestore:rules`; GitHub Pages only serves static files
5. **Cloudflare Worker service-account JSON** — stored only as Worker secrets; original JSON deleted; regenerate via `wrangler secret put` if credentials are lost
6. **`setup-admin.html` was in the public repo** — removed; don't re-add any admin bootstrap utilities without access control

---

## Commit History (All 50 Commits)

| Commit | Message |
|---|---|
| `26d1603` | Show iOS Add to Home Screen banner on load, not hidden behind a video |
| `90d6d80` | Let verification accept phone OR eFootball ID, not just ID |
| `7bf9d8a` | Add explicit verify option for players already in the admin's list |
| `3866076` | Add 'Not you? Switch account' reset link to the profile card |
| `a6328b4` | Fix identity hijack bug in My Matches search |
| `4084b83` | Personalize the app based on registration status |
| `5d7104d` | Show a real profile instead of a generic message for returning players |
| `bc81107` | Retroactively flag players as registered via My Matches lookup |
| `661ba82` | Let admin see which players are on the latest app version |
| `8bbb0a1` | Add update-available banner to the player app |
| `f04b457` | Hide registration form for players who already registered on this device |
| `11fb1ad` | Enforce unique player names at registration |
| `31c4997` | Update help docs for the match-flow overhaul, add player-facing Help |
| `5f50d05` | Document the Cloudflare Worker match-reminder notifier in PROJECT.md |
| `ff08e5c` | Add client-side push notification foundation (step 4, part 1) |
| `a8b20f8` | Add dual score entry with auto-finalize / mismatch detection |
| `00c5897` | Add team/manager setup submission (step 1 of match-flow overhaul) |
| `3b4f517` | Add share button to home banner, sharing the intro video |
| `7ec1ad3` | Trigger Add to Home Screen from the same play button as the video |
| `3ef5f04` | Move intro video mute button to bottom-center |
| `b758099` | Rename install button to 'Add to Home Screen' |
| `b278f33` | Add Install App option to the instructions video overlay |
| `40938b2` | Add unmute toggle to intro video |
| `9ef8e52` | Add instructions video accessible via play button on home banner |
| `3a4580a` | Add intro video overlay on the player-facing home page |
| `9c6e289` | Make welcome banner image fill panel edge-to-edge |
| `64e96de` | Show clear error message when Google sign-in popup fails |
| `0fdf866` | Add in-app Help tab to admin panel with match-day guide |
| `e988dea` | Add ADMIN_GUIDE.md with step-by-step match-day instructions |
| `6816328` | Add default-admin governance model |
| `532791b` | Add PROJECT.md documenting architecture, data model, and auth flow gotchas |
| `67f18f7` | Bump SW cache version after dispute.js change |
| `cf63ff7` | Fix minor audit findings |
| `48a7127` | Revert to signInWithPopup for Google login |
| `8919227` | Replace broken Firebase API key with newly generated one |
| `49a5a97` | Fix remaining audit findings |
| `4e3361f` | Remove dead isSuper/Owner badge UI |
| `f961b30` | Add Firebase CLI config for firestore rules deployment |
| `e63cefb` | Fix critical security/audit issues |
| `780d956` | Remove setup-admin.html from public repo |
| `2b111dd` | Switch Google admin login from popup to redirect flow |
| `cd30a3a` | Add files via upload |
| `51a776d` | Add files via upload |
| `8c1ab93` | Add files via upload |
| `836a21f` | Add files via upload |
| `97d3c75` | Add files via upload |
| `0829b2f` | Add files via upload |
| `18140ca` | Add files via upload |
| `22d88e6` | Add files via upload |
| `d1cbb9e` | Add files via upload |

---

## Current State

**No known bugs.** No `TODO` or `FIXME` comments in the codebase. All discovered issues have been resolved and documented above.

### Potential Future Work (Not Started)
- Mid-tournament player withdrawal / substitution UI (currently requires manual admin handling)
- Advanced bracket seeding algorithms
- Email / SMS notifications (currently push-only via FCM)
- Past-season archive / tournament replay
- Improved bracket export (image/PDF)
