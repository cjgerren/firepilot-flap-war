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
- Set `VITE_REVENUECAT_IOS_API_KEY` and `VITE_REVENUECAT_ANDROID_API_KEY` for mobile store builds.
- Set `CLIENT_URL` to the production frontend URL.
- Set `CORS_ORIGINS` to any additional allowed frontend origins, comma-separated.
- Configure Stripe test/live keys and webhook secret on the backend.
- Configure RevenueCat webhook auth on the backend for mobile store purchases.
- Configure Supabase frontend anon keys and backend service role keys.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Test Stripe checkout plus webhook delivery before enabling live payments.

## Mobile Store Builds

Android and iOS builds use Capacitor and RevenueCat. Web builds use Stripe checkout.

Use the same non-subscription product IDs in App Store Connect, Google Play Console, and RevenueCat:

- `coins_100`
- `coins_200`
- `coins_500`
- `coins_1200`
- `coins_2500`
- `coins_3000`
- `coins_4000`
- `coins_5000`
- `coins_10000`
- `diamonds_10`
- `diamonds_25`
- `diamonds_75`
- `diamonds_150`
- `diamonds_300`

RevenueCat webhook endpoint:

```text
https://your-backend-domain.com/api/revenuecat/webhook
```

Mobile build commands:

```powershell
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Final Android release requires Android Studio and a signed `.aab`. Final iOS release requires Xcode on macOS or a cloud build service.
