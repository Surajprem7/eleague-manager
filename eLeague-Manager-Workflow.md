# eLeague Manager — Workflow & Project Journal

> This document is the full story of the project — every decision, every method tried, every error hit, every fix applied, and every plan made. It is a living document updated after every significant session.

Live app: [league.getgol.in](https://league.getgol.in) | Repo: [github.com/Surajprem7/eleague-manager](https://github.com/Surajprem7/eleague-manager)

---

## 1. What We Are Building

An eFootball tournament management system for local leagues. The goal is a mobile-first Progressive Web App (PWA) that handles the full tournament lifecycle — from player registration to the final result — without requiring any native app install and without paying for any hosting or backend services.

**Why a PWA and not a native app?**
- No App Store approval process
- Instant updates — push to GitHub, users get new version automatically
- Works on any phone (Android + iOS) with a browser
- Free hosting via GitHub Pages

**Why not use an existing tournament platform (Toornament, Challonge, etc.)?**
- We researched Toornament's API (`developer.toornament.com/v2`) — it requires a paid plan and their eFootball discipline integration (`efootball_2024`) is read-only; no way to auto-pull match results from eFootball itself
- We searched GitHub (`github.com/topics/efootball`) for existing JS libraries — nothing useful found; all repos were either abandoned or scrapers that violated Konami's ToS
- Konami's eFootball app uses SSL pinning — bypassing it would be fragile, against ToS, and not maintainable
- **Decision: build our own system.** Players self-report scores; admin resolves mismatches. Simple and reliable.

---

## 2. Systems & Tools Used

| System | Purpose | How Connected |
|---|---|---|
| **Firebase Firestore** | Real-time NoSQL database | JS SDK via `gstatic.com` CDN imports (ES modules) |
| **Firebase Auth** | Google sign-in for admin | `signInWithPopup` (NOT redirect — see Auth Gotchas) |
| **Firebase Cloud Messaging (FCM)** | Push notifications to players | FCM token saved to Firestore; background handler in `sw.js` |
| **GitHub Pages** | Free static hosting | Auto-deploy on every push to `main` branch |
| **Cloudflare DNS** | Custom domain `league.getgol.in` | DNS-only (grey cloud), no proxying |
| **Cloudflare Worker** | Match reminder push trigger | Separate repo `eleague-notifier`; cron every 2 min |
| **Claude Code (AI assistant)** | Development partner | Used throughout — planning, coding, debugging, auditing |
| **Claude for Chrome extension** | Live browser context for AI | MCP bridge; connection issues documented below |

---

## 3. Connection & Integration Methods

### Firebase Connection
- Firebase app initialized in `js/firebase.js` with hardcoded config (API key, project ID, etc.)
- All Firestore/Auth modules imported directly from `gstatic.com` CDN — no npm, no build step
- **Why CDN imports?** No Node.js build pipeline = simpler GitHub Pages deploy
- Real-time listeners use `onSnapshot` — data updates automatically on all connected clients

### GitHub Pages Deploy
- Push to `main` → GitHub Pages picks it up in ~30 seconds
- No CI/CD pipeline needed — static files served directly
- Custom domain set via `CNAME` file in repo root + DNS A record at Cloudflare

### Service Worker (PWA caching)
- `sw.js` registered in both `index.html` and `admin.html`
- Cache strategy (current, after fixes):
  - **HTML/navigation**: network-first (always get latest markup)
  - **JS/CSS/images**: cache-first (fast loads; new versions via SW update flow)
- Cache key bumped on every deploy (e.g. `eleague-v44`) to bust old caches

### Claude for Chrome Extension
- Installed as a Chrome extension; allows Claude to read browser context
- **Issue encountered**: Extension showed "ready/signed in" but MCP tool `tabs_context_mcp` returned "Claude in Chrome is not connected"
- **Root cause**: Stale MCP bridge handshake — extension had a dead connection from a prior session
- **Fix**: Navigated to a normal `https://` page, ensured extension was signed in, reconnected

### Cloudflare Worker (Push Notification Trigger)
- Separate repository: `eleague-notifier`
- Runs on Cloudflare's edge on a cron every 2 minutes
- **Why not Firebase Cloud Functions?** Requires paid Blaze plan — project stays on free Spark tier
- **Auth challenge**: Cloudflare Workers can't use Node's `google-auth-library`
- **Solution**: Manually implemented Firebase service-account JWT signing using Web Crypto API (available in Workers)
- Credentials stored as Cloudflare Worker secrets (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — never committed to any repo
- Deployment: `npx wrangler deploy` from `eleague-notifier` directory

---

## 4. Project Timeline & What Was Built (Chronological)

### Phase 1 — Foundation
- Initial file upload to GitHub
- Basic player registration form
- Firebase Firestore for player data
- Admin panel with Google sign-in

### Phase 2 — Auth Overhaul
**Problem**: Google sign-in was using `signInWithRedirect`. This broke silently on Chrome due to cross-origin storage partitioning — `getRedirectResult()` returned `null` with no error.

**What we tried**:
1. Debugging `getRedirectResult()` — returned null consistently
2. Checking Firebase Auth domain settings — correct
3. Checking CORS — not the issue

**Root cause found**: Chrome's third-party cookie / storage partitioning changes mean redirect sign-in doesn't work when the app is on a custom domain (`league.getgol.in`) but Firebase Auth domain is `eleague-manager.firebaseapp.com`. The redirect goes to Firebase, sets cookies, but they're not readable when it returns to the custom domain.

**Fix**: Permanently switched to `signInWithPopup`. Works reliably. Documented to never switch back.

### Phase 3 — Security Audit
- Ran a full security audit; found critical issues
- Fixed in commits `e63cefb`, `49a5a97`, `cf63ff7`
- Key fixes:
  - `setup-admin.html` was publicly accessible in the repo — deleted entirely
  - Firestore rules were too permissive — tightened to field-level writes only
  - Added two-layer auth: client-side (`isAdminEmail()`) + server-side (`isAdmin()` in rules)
  - Default-admin governance: `surajtxglive@gmail.com` hardcoded as permanent in both layers
  - `isAdminEmail()` was doing a full collection scan — switched to single-document `get()`
  - Dead `isSuper`/`Owner` badge UI removed (field never set by any code)

### Phase 4 — Player Identity System
**Problem**: Multiple identity bugs discovered:
1. Searching any player name in "My Matches" overwrote the device's identity — serious security/UX issue
2. Players on new/cleared devices had no way to re-link their account
3. Verification only accepted eFootball ID — locked out players who forgot their ID
4. Players recognized on device but no profile shown — just "you're registered" text

**Solutions built** (in order):
1. `myRegisteredName` localStorage flag — set on first registration; identity never overwritten by search
2. "Already registered? Verify here" flow on Register tab — name + phone OR eFootball ID
3. "Not you? Switch account" reset link on profile card
4. Real profile card for recognized players (name, eFootball ID, phone, group, status badge)
5. Retroactive flag-setting — finding yourself via My Matches search also sets the flag

### Phase 5 — Match Flow Overhaul
**Goal**: Reduce admin workload by letting players self-report scores.

**Flow built**:
1. Both players report the final score independently from My Matches tab
2. If both agree → match auto-completes (Firestore write rule enforces the transition)
3. If they disagree → `scoreMismatch` flag set; both see warning; admin resolves

**Edge case found and fixed**: `submitPlayerScore()` called `snap.data()` without checking `snap.exists()` first — caused a crash if the match document was missing. Fixed: added exists check, returns `'waiting'` if doc missing.

### Phase 6 — Push Notifications
**Architecture**:
- Player opts in via "Enable" button in My Matches
- FCM token saved to their Firestore player doc
- Cloudflare Worker polls every 2 minutes for matches starting in ~10 minutes
- Sends FCM push; marks match `notified10Min: true` to prevent duplicates

**Challenge**: FCM HTTP v1 API requires a service account JWT — can't use `google-auth-library` in Workers
**Solution**: Manually sign JWT using Web Crypto API

### Phase 7 — Group Builder Improvements

**Problems**:
1. No way to choose group format (4-player, 3-player, 2 groups)
2. No way to move players between groups on mobile
3. No per-group confirmation before generating schedule
4. Group draft lost on page refresh

**Methods tried for player reassignment**:
- Drag-and-drop — didn't work reliably on mobile touch screens
- **Switched to**: Move → dropdown on each player tile; picks destination group, moves instantly

**Group draft bug** (complex):
- Added `saveGroupDraft()` writing to `localStorage` key `eleague_group_draft`
- **Bug found**: Draft not restoring on reload
- **Root cause**: The approve button had `data-group="${letter}"` — same attribute as the group box `[data-group]` selector. The selector matched the approve button (which had no players), reading its empty player list and overwriting the saved group with an empty array in localStorage on every read
- **Fix**: Changed approve button attribute to `data-letter` to avoid selector collision
- **Second bug**: Draft only saved `{A:[...]}` — format selection not saved
- **Fix**: Draft now saves `{format: '3', groups: {A:[...]}}` — radio button restored to correct position on load

### Phase 8 — PWA Caching & Update System

**Problem found**: F5 (soft refresh) served stale `admin.html` from SW cache; Ctrl+R (bypass SW) got fresh file.

**Root cause**: SW was using cache-first for ALL assets including HTML. F5 goes through SW (serves cached HTML); Ctrl+R bypasses SW entirely.

**Fix**: Changed fetch strategy:
- HTML / navigation requests → network-first (always fetch fresh, fall back to cache offline)
- JS / CSS / images → cache-first (fast loads)

**Update banner problems** (two separate bugs):

*Bug 1 — No update banner at all on admin*: Admin page had no SW registration or update detection code. Added full SW registration + update banner to `admin.html`.

*Bug 2 — Multiple banners on same screen*: The `alreadyShown` guard only covered the `controllerchange` path, but `showUpdateBanner()` could also be called from `registration.waiting` check and `statechange` event — all three could fire for the same update.
**Fix**: Moved `alreadyShown` inside `showUpdateBanner()` itself so the first caller wins regardless of path.

*Bug 3 — Users never getting updates*: `registration.update()` was only called on `visibilitychange`. If a user opened the app and stayed on it, the browser never checked for a new SW.
**Fix**: Call `registration.update()` immediately on load AND set a `setInterval` to check every 60 seconds.

### Phase 9 — Colour Scheme Rebrand

**Requested**: Change from teal green `#1D9E75` to **Tiffany** `#21F1A8` + **Dark Gray** `#171717`

**Palette interpretation** (from user-provided image):
- Tiffany = header background (top half of the palette image)
- Dark Gray = body/page background (bottom half)
- Text on Tiffany = dark `#171717`
- Text on Dark Gray = Tiffany `#21F1A8` or light gray for body

**Files updated**: `css/style.css`, `css/admin.css`, `manifest.json`, `index.html`, `admin.html`, `bracket.html`, `stats.html`

**Issues during rebrand**:
1. First attempt — app went "full black" — card surfaces (#1E1E1E) too close to background (#171717); couldn't distinguish elements
   - **Fix**: Increased card surface to #242424 with `border: 1px solid #333` for visible separation
2. Header was dark — user pointed out palette shows Tiffany on top (header) and Dark Gray at bottom (body)
   - **Fix**: Header background changed to `#21F1A8`, text to `#171717`
3. Help modal still white after initial dark theme pass — inline `background:#fff` in HTML, not in CSS
4. Move-select dropdown still white — also inline style
5. `bracket.html` and `stats.html` missed — had their own hardcoded colors not in the CSS
6. `--gray-700` CSS variable used in inline styles but never defined in dark theme — text would be invisible
   - **Fix**: Added `--gray-700: #CCCCCC` to `:root`
7. Stats hero section had white text on Tiffany gradient — low contrast
   - **Fix**: Changed to `#171717` dark text

**Full audit run after rebrand** — found and fixed all remaining white/light surfaces across all 5 pages.

### Phase 10 — Banner & Instructions Video Always Visible

**Problem**: Banner image and instructions video play button only appeared on Home when tournament had no status set (pre-tournament state). Once tournament started or ended, they disappeared.

**Fix**: Extracted banner HTML into a `BANNER_HTML` constant and prepended it to all three `renderHome()` branches — no status, active tournament, and done/winner states.

---

## 5. Errors Encountered & How They Were Solved

| Error | Where | Root Cause | Fix |
|---|---|---|---|
| `auth/api-key-not-valid` | Firebase Auth | API key restrictions changed or key rotated | Generated new API key scoped to Identity Toolkit + Token Service + Cloud Firestore |
| `getRedirectResult()` returns null silently | `js/auth.js` | Chrome cross-origin storage partitioning between custom domain and Firebase authDomain | Switched to `signInWithPopup` permanently |
| Google popup errors swallowed | `js/auth.js` | `loginWithGoogle()` returned null on failure | Now throws friendly Error, surfaced via toast |
| `snap.data()` crash | `js/matches.js` | Called without `snap.exists()` check when match doc was missing | Added exists check; returns `'waiting'` if doc missing |
| `where('__name__', '==', id)` inefficiency | `js/stats.js` | Wrong query pattern for fetching single document by ID | Replaced with `getDoc(doc(db, 'players', playerId))` |
| F5 serving stale admin.html | `sw.js` | Cache-first for all assets including HTML | Network-first for HTML/navigation; cache-first for static assets |
| Group draft not saving | `admin.html` | Approve button `data-group` attribute conflicted with group box selector; empty player list overwrote draft | Changed approve button attribute to `data-letter` |
| Draft not restoring format | `admin.html` | Draft only saved `{A:[...]}` not the format | Draft now saves `{format, groups}`; radio button restored on load |
| Duplicate update banners | `index.html`, `admin.html` | `alreadyShown` guard only on `controllerchange` path; other two paths had no guard | Moved guard inside `showUpdateBanner()` |
| No SW update notification for users sitting on app | `index.html`, `admin.html` | `registration.update()` only called on `visibilitychange` | Call on load + `setInterval` every 60 seconds |
| App looked "full black" | `css/style.css` | Card surface (#1E1E1E) indistinguishable from background (#171717) | Cards → #242424 with #333 border |
| White text on Tiffany header (low contrast) | `css/style.css`, HTML | Tiffany is a bright colour — white text fails contrast | All text on Tiffany surfaces uses #171717 dark text |
| `--gray-700` undefined | `css/style.css` | New dark theme omitted this variable; inline styles referenced it | Added `--gray-700: #CCCCCC` |
| Help modal still white after dark theme | `index.html` | Inline `background:#fff` — not picked up by CSS variable change | Changed inline style to `#242424` |
| Claude for Chrome "not connected" | MCP bridge | Stale handshake from prior session | Navigated to fresh https page; extension reconnected |

---

## 6. Methods We Tried vs Methods We Use Now

### Score Reporting
| Method Tried | Result | Current Method |
|---|---|---|
| Admin manually enters all scores | Too slow; admin needed for every match | Players self-report; admin only resolves mismatches |
| Pull scores from eFootball API (Konami) | No public API; SSL pinning; ToS violation risk | Not pursued |
| Toornament API integration | Read-only; requires paid plan; no live score sync | Not pursued |

### Player Group Assignment
| Method Tried | Result | Current Method |
|---|---|---|
| Drag-and-drop on mobile | Unreliable touch handling | Move → dropdown per player |

### Admin Authentication
| Method Tried | Result | Current Method |
|---|---|---|
| `signInWithRedirect` | Silently broken on custom domain (Chrome storage partitioning) | `signInWithPopup` |

### Push Notification Trigger
| Method Tried | Result | Current Method |
|---|---|---|
| Firebase Cloud Functions | Requires paid Blaze plan | Cloudflare Worker (free, cron-triggered) |

### SW Update Detection
| Method Tried | Result | Current Method |
|---|---|---|
| Only `visibilitychange` | Users sitting on app never notified | On load + every 60s + visibilitychange |
| `alreadyShown` only on `controllerchange` | Multiple banners from other SW event paths | Guard inside `showUpdateBanner()` itself |

### Caching Strategy
| Method Tried | Result | Current Method |
|---|---|---|
| Cache-first for all assets | Stale HTML served on F5 | Network-first for HTML; cache-first for JS/CSS/images |

---

## 7. Current Architecture Summary

```
User's Phone
    │
    ▼
league.getgol.in (Cloudflare DNS → GitHub Pages)
    │
    ├── index.html (Player app)
    ├── admin.html (Admin panel — Google auth required)
    ├── bracket.html (Knockout bracket view)
    ├── stats.html (Leaderboard)
    ├── sw.js (Service worker — caching + push background handler)
    └── js/ + css/ + assets/
            │
            ▼
    Firebase Firestore (real-time DB)
    Firebase Auth (Google sign-in)
    Firebase Cloud Messaging (push tokens)
            │
            ▼
    Cloudflare Worker (eleague-notifier)
    — polls Firestore every 2 min
    — sends FCM push for upcoming matches
```

---

## 8. Project Plans & Future Work

### Planned (Discussed, Not Started)
- **Mid-tournament player withdrawal** — currently requires manual admin handling (delete player, manually adjust groups/matches)
- **Advanced bracket seeding** — currently random; plan to seed by group standings
- **Email / SMS notifications** — currently push-only via FCM; explore SendGrid or Twilio for players who don't install PWA
- **Past-season archive** — each tournament overwrites the previous; plan a season/archive model
- **Improved bracket export** — current canvas export is basic; plan PDF/image download with branding

### Ideas Being Considered
- **WhatsApp bot integration** — send match schedule and results via WhatsApp Business API
- **Player head-to-head history** — show record between two specific players
- **Mini-league standings embed** — shareable iframe/link for group standings

### Decisions Made & Not Revisiting
- **No native app** — PWA is sufficient; avoids App Store overhead
- **No backend server** — Firebase + Cloudflare Worker covers all needs on free tier
- **No drag-and-drop on mobile** — replaced with Move dropdown permanently
- **No eFootball API integration** — not viable (no public API, SSL pinning, ToS)

---

## 9. Version History

| Version | Key Changes |
|---|---|
| `v44` | Banner + instructions always shown on Home in all states |
| `v43` | Full audit — all remaining white surfaces fixed for dark theme |
| `v42` | Tiffany header + Dark Gray body — correct palette interpretation |
| `v41` | Dark theme contrast fix — cards #242424 with borders |
| `v40` | Full dark theme applied across all pages |
| `v39` | SW update check on load + every 60s |
| `v38` | Test bump for update banner verification |
| `v37` | Tiffany #21F1A8 + Dark Gray #171717 colour scheme |
| `v36` | Full audit: crash guards, admin update banner, stats.js efficiency |
| `v35` | Save Draft for group builder; fix draft restore bug |
| `v34` | Group builder: Move dropdown, Approve per group, format labels |
| `v33` | Group format picker (4-player, 3-player, 2 groups) |
| `v32` | Admin → Player switch button |
| `v31` | Remove player feature in admin |
| `v30` | Admin nav button + PWA manifest shortcut |
| Earlier | See git log for full history |

---

*Last updated: June 2026 — v44*
