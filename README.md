# eLeague Manager

eFootball tournament management PWA — built for `league.getgol.in`

## Setup

1. Update admin email in `js/auth.js` (line 5) with your actual Gmail address
2. Push all files to GitHub repo `Surajprem7/eleague-manager`
3. Enable GitHub Pages → main branch → root folder
4. Add CNAME in Cloudflare: `league` → `Surajprem7.github.io`
5. Add your domain to Firebase Auth → Authorized domains

## Folder structure

```
eleague-manager/
├── index.html        Player app
├── admin.html        Admin panel (Google login)
├── manifest.json     PWA config
├── sw.js             Service worker (offline)
├── CNAME             Custom domain
├── css/
│   ├── style.css
│   └── admin.css
├── js/
│   ├── firebase.js
│   ├── auth.js
│   ├── app.js
│   ├── admin.js
│   ├── tournament.js
│   ├── matches.js
│   └── notify.js
└── assets/
    ├── icon-192.png  (add your icon)
    ├── icon-512.png  (add your icon)
    └── splash.png    (add splash screen)
```

## URLs

- Player app: `https://league.getgol.in`
- Admin panel: `https://league.getgol.in/admin.html`
