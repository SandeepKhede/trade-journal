# Trading Journal Dashboard (React + Ant Design + Firebase)

This is a starter Trading Journal Dashboard built with React, Ant Design (antd), Recharts, and Firebase (Firestore). It provides a responsive UI to record trades, view analytics, and reflect on your trading decisions.

Features included in this starter:

- Dashboard overview: key metrics (Total P&L, Win rate, Total trades, Avg P/L)
- Charts: P&L over time, trades count, win/loss pie
- Trade Journal table with sortable columns
- Trade entry form (saves to Firebase Firestore or localStorage fallback)
- Local sample data if Firebase config is not provided

Tech stack
- React + Vite
- Ant Design (UI)
- Recharts (charts)
- Firebase Firestore (optional persistence)

Getting started

1. Install dependencies

```powershell
npm install
```

2. Run dev server

```powershell
npm run dev
```

Open the app at the address printed by Vite (usually http://localhost:5173)

Configure Firebase (optional)

If you want to persist data to Firebase, create a Firebase project and Firestore database. Then inject your Firebase config on the page (for local dev) by opening `index.html` and adding a script tag before the app script, for example:

```html
<script>
  window.__FIREBASE_CONFIG__ = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    // ... the rest of the config
  }
</script>
```

The app will initialize Firebase automatically if `window.__FIREBASE_CONFIG__` is present.

Notes and next steps
- This starter uses a simple localStorage fallback when Firebase is not configured. For production, add proper auth and security rules.
- You can extend analytics (risk/reward, equity curve calculations) in `src/components/Dashboard.jsx`.
- Add filters, sorting UI, and an insights panel with AI-based summaries as a follow-up.

If you'd like, I can:
- Add Firebase Auth (email/password) and secure Firestore rules.
- Implement filters (date range, strategy, instrument) in the UI and wire them to queries.
- Add import/export (CSV) and backup features.

Enjoy — tell me which next step you want me to implement and I'll proceed.
# trade-journal
