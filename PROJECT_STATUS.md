# eLeague Manager — Project Status

Last updated: June 2026 | App version: `v44` | Branch: `main`

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
| PWA | Service worker (`sw.js`, cache key `eleague-v44`), installable on Android + iOS |

---

## Colour Scheme

| Role | Colour |
|---|---|
| Primary / Header background | Tiffany `#21F1A8` |
| Dark accent (text on Tiffany, hover) | `#0DB87E` |
| App background | Dark Gray `#171717` |
| Card / nav surfaces | `#242424` |
| Elevated inputs / dropdowns | `#2E2E2E` |
| Body text | `#EEEEEE` |
| Muted text | `#AAAAAA` / `#CCCCCC` |

All five pages (index, admin, bracket, stats + both CSS files) use the same dark-theme variables. No white surfaces remain — all modals, dropdowns, and stat boxes use dark backgrounds.

---

## File Structure

```
eleague-manager/
├── index.html              Player app
├── admin.html              Admin panel
├── bracket.html            Shareable knockout bracket
├── stats.html              Leaderboard & player stats
├── manifest.json           PWA config (theme: #21F1A8, background: #171717)
├── sw.js                   Service worker (cache: eleague-v44)
├── firestore.rules         Firestore security rules
├── firebase.json           Firebase CLI config
├── .firebaserc             Firebase project mapping
├── CNAME                   Custom domain: league.getgol.in
├── PROJECT.md              Architecture & data model reference
├── ADMIN_GUIDE.md          Step-by-step admin guide
├── PROJECT_STATUS.md       This file
├── css/
│   ├── style.css           Player app styles (dark theme variables)
│   └── admin.css           Admin styles (extends style.css)
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
- **Banner image always shown at top of Home** — visible in all states (registration, active tournament, champion announced)
- **Instructions video** — play button overlaid on banner; tapping opens full-screen instructions video in all home states
- Intro video overlay — auto-plays muted on load, skippable, non-blocking on error
- Share button on banner (native share sheet → intro video + join link; fallbacks to text/clipboard)
- iOS "Add to Home Screen" dismissible banner shown at startup (doesn't overlap update banner)
- Android/Edge install prompt via `beforeinstallprompt`; iOS shows manual tap-share hint
- "Update available" one-tap reload banner — appears automatically within 60 seconds of a new deploy (SW polled on load + every 60s + visibilitychange); shows only once per update (single `alreadyShown` guard covers all three SW event paths)
- Tournament champion announcement page when phase = `done`
- **Score submission from My Matches**: both players report independently
  - If both agree → match auto-completes (Firestore rule enforces the transition)
  - If they disagree → `scoreMismatch` flagged, both players see "not matching" message, admin resolves
- Team/manager setup submission after confirming ready on Join tab
- Push notification opt-in ("Enable" button on My Matches) — saves FCM token to Firestore
- Standings tab: group-by-group, tiebreakers (Points → GD → GF), top 2 qualified marked
- Dispute tab: flag wrong results (match ID + reason)
- In-app Help modal: step-by-step guide (register → confirm → play → report → standings → notifications)
- **⚙️ Admin** nav button at the end of the bottom nav — navigates to `admin.html` directly from the player app

### Admin Panel (`admin.html`)

- Google sign-in (popup-based — see Gotchas)
- Default-admin governance: `surajtxglive@gmail.com` is permanent; only default admin can add/remove others; max 3 admins; other admins cannot see default admin in the list
- **👤 Player** switch button in admin header — navigates to `index.html` without logging out
- **Players tab**: approve/reject registrations; see eFootball ID, phone, group; green "Latest" / red "Outdated" app version badge per player; **🗑️ remove button** permanently deletes a player with confirmation
- **Groups tab**:
  - Format picker — **4 Player Group**, **3 Player Group**, or **2 Groups**
  - **Move → dropdown** on every player tile to reassign between groups
  - **✓ Approve Group** button per group; auto-resets if player is moved
  - **Save Draft** — persists format + group assignments to `localStorage` key `eleague_group_draft`; survives refresh; restored on reload (validates all IDs still in approved list); cleared on final save or format reapply
  - **Save Groups & Generate Schedule** locked until all groups approved; shows progress (e.g. `2/4 approved`)
  - Auto-generates full round-robin per group on save
- **Matches tab**: Set Live (max 2 concurrent); Schedule with date/time; Enter Score; view team setups; score mismatches with both submitted scores; status badges
- **Knockout tab**: same as Matches; winners auto-advance; 3rd place match from SF losers
- **Results tab**: all completed matches, score override
- **Disputes tab**: resolve with admin notes
- **Activity Log tab**: append-only audit trail
- **Admins tab** (default admin only): add/remove up to 3 total
- **Help tab**: full match-day guide inline
- **Update banner** — same SW update detection as player app (Tiffany banner at top of screen)

### Stats Page (`stats.html`)
W/D/L, goals for/against, win rate, match history per player, top scorers leaderboard, knockout stage reached. Dark theme applied throughout.

### Bracket Page (`bracket.html`)
Shareable knockout bracket view, canvas image export. Dark theme applied throughout.

---

## Tournament Flow (End-to-End)

1. **Registration phase** — players self-register, status `pending`
2. Admin approves players in Players tab
3. Admin assigns groups → "Save & Generate Schedule" → full round-robin auto-generated
4. **Group stage** — admin sets match live (max 2 at once), shares join code; players confirm ready + submit team setup; players enter final score → auto-completes or flags mismatch
5. **Knockout auto-generated** once all group matches done
6. **Knockout** — same flow as group stage, winners auto-advance
7. Final completed → winner announced on player app, WhatsApp share text generated

---

## Push Notification Architecture

**Client side** (`js/push.js`):
- Requests permission, gets FCM token via VAPID key
- Saves `fcmToken` + `fcmTokenAt` to player's own Firestore doc
- Background message handler merged into `sw.js`

**Trigger side** (separate repo: `C:\Users\User\Documents\eleague-notifier`):
- Cloudflare Worker with cron trigger every 2 minutes
- Finds matches with `scheduledAt` in next ~11 minutes that haven't been notified (`notified10Min` not set)
- Authenticates to Firestore + FCM HTTP v1 API via Firebase service-account JWT — implemented manually with Web Crypto
- Sends push to each player's `fcmToken`, marks match `notified10Min: true`
- Credentials stored only as Cloudflare Worker secrets — never committed

**Why not Firebase Cloud Functions**: requires paid Blaze plan; this project stays on free Spark tier.

---

## Security Model

### Two independent auth layers
1. **Client-side** `isAdminEmail()` in `auth.js` — reads `admins` collection, gates UI (UX only)
2. **Server-side** `isAdmin()` in `firestore.rules` — `exists()` check before any admin write (actual security boundary)

### What non-admins can write
| Collection | Allowed writes |
|---|---|
| `players` | Own doc only: `fcmToken`, `fcmTokenAt`, `appVersion`, `appVersionAt` |
| `matches` | Own match only: team setup fields, score report fields, auto-finalize transition (only when both reports agree) |
| `disputes` | Create only |
| `activity_log` | Create only (self-logging dispute submissions) |

---

## Bugs Fixed (Full History)

### Identity & Player Recognition

| Bug | Fix |
|---|---|
| Identity hijack in My Matches search | Flag set only on first lookup; version reporting fires only for known device identity |
| No re-link path on new/cleared devices | "Already registered? Verify here" flow on Register tab |
| Verification only accepted eFootball ID | Now accepts name + phone OR eFootball ID |
| `myRegisteredName` never set retroactively | Finding yourself via My Matches also sets the flag |
| Registration form showed for already-registered players | `myRegisteredName` localStorage flag added |
| No profile shown for recognized players | Real profile card (name, ID, phone, group, status badge) |

### Security & Auth

| Bug | Fix |
|---|---|
| Firebase API key stopped working | New key scoped to correct APIs |
| Google sign-in redirect broken (cross-origin storage partitioning) | Switched permanently to `signInWithPopup` |
| Sign-in popup errors swallowed silently | Throws friendly error, surfaced via toast |
| Admin collection read broken under privacy rules | Switched to single-document `get()` |
| No default-admin governance | Hardcoded in both `auth.js` and `firestore.rules`; max 3 admins |
| `setup-admin.html` in public repo | Deleted entirely |
| Critical security/audit findings | Fixed across multiple commits |

### Data Integrity

| Bug | Fix |
|---|---|
| Duplicate player names allowed | Registration blocks duplicate names (case-insensitive) |
| `snap.data()` called without `snap.exists()` check in `submitPlayerScore()` | Added exists check; returns `'waiting'` if doc missing |
| `stats.js` using `where('__name__', '==', id)` collection query | Replaced with `getDoc()` single-document read |

### PWA / Service Worker

| Bug | Fix |
|---|---|
| F5 served stale `admin.html` from SW cache | HTML/navigation requests use network-first strategy; static assets remain cache-first |
| SW update only checked on `visibilitychange` | Now checks immediately on load + every 60 seconds |
| Duplicate update banners on same screen | Single `alreadyShown` guard inside `showUpdateBanner()` covers all three SW event paths (`waiting`, `statechange`, `controllerchange`) |
| No update banner on `admin.html` | Full SW update detection added to admin page |

### UX

| Bug | Fix |
|---|---|
| iOS "Add to Home Screen" banner hidden behind play button | Standalone dismissible banner shown on page load |
| No admin access from installed PWA | ⚙️ Admin nav button + PWA manifest shortcut |
| No way to move players between groups on mobile | Move → dropdown per player tile |
| No per-group confirmation before saving | ✓ Approve Group per group; Save locked until all approved |
| Group draft not saved across refresh | Save Draft → `localStorage`; restored on reload |
| Draft only saved group data, not format | Draft now saves `{format, groups}`; radio button restored on load |
| Banner/instructions video hidden once tournament started | Banner + play button always shown at top of Home in all states |

---

## Deliberate Architecture Decisions

| Decision | Why |
|---|---|
| No framework (vanilla JS) | No build step = simple GitHub Pages deploy; fast loads |
| No Firebase Cloud Functions | Requires paid Blaze plan; push trigger moved to Cloudflare Worker |
| No Firebase Hosting | GitHub Pages + Cloudflare DNS is simpler and free |
| `signInWithPopup` not `signInWithRedirect` | Redirect broken by Chrome cross-origin storage partitioning |
| Player-side score reporting + auto-finalize | Reduces admin workload |
| Two independent auth layers | Client-side is UX only; rules are the actual security boundary |
| Service-account JWT built manually with Web Crypto | Cloudflare Workers can't use Node's `google-auth-library` |
| Default admin hardcoded in both layers | Governance can't be bypassed even if one layer is edited |
| Dark theme via CSS variables | Single source of truth; all pages import `style.css` |

---

## Deployment

| What | How |
|---|---|
| App code | Push to `main` → GitHub Pages auto-deploys |
| Firestore rules | `firebase deploy --only firestore:rules` — manual |
| New version rollout | Bump `CACHE` in `sw.js` + `APP_VERSION` in `index.html` + `CURRENT_APP_VERSION` in `admin.html` |
| Push notification Worker | `cd eleague-notifier && npx wrangler deploy` |

---

## Known Gotchas

1. **Browser HTTP caching** — SW cache version bump is the only lever (GitHub Pages can't set custom headers)
2. **Firebase API key** — can randomly stop working; generate a new one scoped to the right APIs
3. **Redirect sign-in is broken** — always use `signInWithPopup`
4. **Firestore rules must be manually deployed** — GitHub Pages only serves static files
5. **Cloudflare Worker credentials** — stored as Worker secrets only; regenerate via `wrangler secret put` if lost
6. **`setup-admin.html`** — removed; don't re-add any admin bootstrap utilities without access control
7. **Tiffany (#21F1A8) is a bright colour** — always use dark text (#171717) on Tiffany backgrounds; reserve white text for truly dark surfaces only

---

## Commit History (This Session)

| Commit | Message |
|---|---|
| `b05ab36` | Always show banner + instructions play button on home screen — v44 |
| `b282540` | Fix all remaining white/light surfaces for dark theme — v43 |
| `8a7c018` | Match colour palette — Tiffany header, Dark Gray body — v42 |
| `fa59007` | Fix dark theme contrast — surfaces visibly distinct from background — v41 |
| `08a75fa` | Full dark theme — Tiffany + Dark Gray throughout — v40 |
| `c0d4e7b` | Force immediate SW update check on load + every 60s — v39 |
| `13ac3ff` | Bump to v38 to test update banner fix |
| `0a921a8` | Fix duplicate update banners — single alreadyShown guard across all SW paths |
| `13632c4` | Rebrand colour scheme to Tiffany (#21F1A8) + Dark Gray (#171717) — v37 |
| `23b9c88` | Full audit fixes — crash guards, admin update banner, efficiency |
| `a5e2a04` | Fix stale admin.html served from SW cache on F5 |
| `da4e571` | Fix draft saving format selection and restore sync |
| `44a1138` | Fix group draft save and simplify Apply button |
| `3cbd69c` | Add Save Draft to group builder — survives refresh |
| `74dc971` | Improve group builder — rename formats, move player, per-group approve |
| `fc393ea` | Add group format picker — groups of 4, groups of 3, or 2 groups |
| `7e184d4` | Add Player View switch button to admin header |
| `446e780` | Add remove player option to admin Players tab |
| `d09188a` | Add Admin nav link to player app and PWA shortcut |

---

## Current State

**No known bugs.** All surfaces use the dark theme. Banner and instructions video are always visible on the Home tab. SW update detection is reliable — users see the banner within 60 seconds of a new deploy without any manual action.

### Potential Future Work (Not Started)
- Mid-tournament player withdrawal / substitution UI
- Advanced bracket seeding algorithms
- Email / SMS notifications (currently push-only via FCM)
- Past-season archive / tournament replay
- Improved bracket export (image/PDF)
