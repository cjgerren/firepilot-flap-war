# FirePilot: Tunnel Run

Fast-paced tunnel-flight browser game built with React + Vite.

## 🎮 Features

- Real-time gameplay
- Score + coin system
- Weapons and upgrades
- Shield system (Mk-II support)
- Special abilities (BLAST, Tunnel Bomb)
- Audio system (music + SFX)
- Local save + cloud save (Supabase-ready)

## 💰 Monetization

- In-game currency (coins)
- Upgrade system
- Stripe integration for purchases (in progress)

## 🛠 Tech Stack

- React + Vite
- Node.js + Express
- Supabase (Auth + DB)
- Stripe (payments)

## 🚀 Getting Started

npm install  
npm run dev  

## 📄 Contact

cjgerren@gmail.com

## Release Checklist

- Set `VITE_ENABLE_DEV_LOGIN=false` or leave it unset for production.
- Set `VITE_MASTER_EMAILS` only if you want specific Supabase account emails to get master unlocks.
- Set `CLIENT_URL` to the production frontend URL.
- Set `CORS_ORIGINS` to any additional allowed frontend origins, comma-separated.
- Configure Stripe test/live keys and webhook secret on the backend.
- Configure Supabase frontend anon keys and backend service role keys.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Test Stripe checkout plus webhook delivery before enabling live payments.
