# FirePilot: Flap War

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
- Stripe integration for web purchases

## 🛠 Tech Stack

- React + Vite
- Supabase (Auth + DB)
- Supabase Edge Functions (web Stripe checkout + sync + webhook)
- Stripe (payments)
- Node.js + Express (legacy/optional API path, still used for some non-web flows)

## 🚀 Getting Started

npm install  
npm run dev  

## Mobile App

FirePilot is configured as a Capacitor app with Android and iOS native projects.

```bash
npm run mobile:sync
npm run android:open
npm run ios:open
```

Android builds require a local JDK/Android toolchain. iOS builds require Xcode on macOS. The optional blow special control requires microphone permission, which is declared in both native projects.

### Mobile control behavior (current)

- Mobile gameplay uses external touch controls (`FLAP` + `FIRE`) outside the main play area.
- Web gameplay still uses keyboard controls (`Space`, `F`, `B`, `T`) and does not depend on touch controls.
- Settings visibility is platform-scoped:
  - Web (`firepilotwar.com` and Vercel previews): keyboard rebinding visible, mobile settings hidden.
  - Native Android/iOS app builds: mobile settings visible, keyboard rebinding hidden.
- In Settings on mobile, players can choose left/right side layout for `FLAP` and `FIRE`.
- Mic mode can be enabled on mobile for special actions:
  - Uses a gated blow detector (quiet-then-burst pattern) to reduce ambient noise triggers.
  - A blow can trigger both special paths across time:
    - If Tunnel Bomb is ready, blow triggers Tunnel Bomb first.
    - Otherwise, if Blast is ready, blow triggers Blast.
- Store/armory items not marked live are now non-purchasable and shown as `COMING SOON`.

### Mobile build/sync workflow

Use this order whenever changing game code for Android/iOS:

```bash
npm run build
npx cap sync
```

Then open native projects:

```bash
npx cap open android
npx cap open ios
```

Notes:

- Do not run `npm run build` inside Android Studio; build web assets from the project root terminal.
- If native app behavior looks stale, run `npm run build` and `npx cap sync` again before retesting.
- If web behavior looks stale after deploy, force-refresh browser cache and purge CDN cache for `/index.html` and `/assets/*`.

### iOS App Store build

Use the App Store mode when preparing iOS assets for review:

```bash
npm run mobile:sync:ios:appstore
```

This mode uses `.env.appstore-ios`, disables local developer login, disables external Stripe checkout in the iOS bundle, and hides unfinished catalog entries from the in-app Armory. Normal web builds still use `npm run build` and keep the existing web purchase flow.

Before archiving in Xcode, confirm the production values are correct:

- `VITE_ENABLE_DEV_LOGIN=false`
- `VITE_DISABLE_EXTERNAL_PURCHASES=true`
- `VITE_API_BASE_URL` points to a live production API if Android Google Play verification is enabled.
- `VITE_OWNER_EMAILS` and/or `VITE_OWNER_USER_IDS` include the real owner account if you want owner-only controls on the live web app.
- Supabase frontend keys are configured for cloud save/auth if those features are enabled.

### Web Stripe (Supabase Edge Functions)

Web Stripe purchases now use Supabase Edge Functions (not Railway):

- `stripe-create-checkout-session`
- `stripe-sync-checkout-session`
- `stripe-webhook`

Required frontend env for web:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DISABLE_EXTERNAL_PURCHASES=false`

Required Supabase function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_APP_NAME` (optional, defaults to `FirePilot`)
- `WEB_CLIENT_URL` (e.g. `https://firepilotwar.com`)

Deploy functions:

```bash
supabase functions deploy stripe-create-checkout-session
supabase functions deploy stripe-sync-checkout-session
supabase functions deploy stripe-webhook
```

Stripe dashboard webhook endpoint should point to:

`https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`

### Android Google Play Billing

Android now supports Google Play Billing for consumable coin and diamond packs without changing the web Stripe checkout flow. The Android app expects these Google Play in-app product IDs to exist in Play Console:

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

For Android production builds, confirm:

- `VITE_API_BASE_URL` points to the live backend API. Native Android builds do not fall back to `localhost`.
- `GOOGLE_PLAY_PACKAGE_NAME` matches the Android package id in Play Console.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` is the Play Developer API service account email.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` is the matching private key, with newline characters preserved or escaped as `\n`.
- The Play Console app is linked to the same service account with Android Publisher access.
- Supabase frontend and backend keys are configured so verified purchases can be written into `player_saves`.

## 📄 Contact

cjgerren@gmail.com

## Release Checklist

- Set `VITE_ENABLE_DEV_LOGIN=false` or leave it unset for production.
- Set `VITE_OWNER_EMAILS` and/or `VITE_OWNER_USER_IDS` if a real authenticated owner account should be able to grant itself full access.
- Set `CLIENT_URL` to the production frontend URL.
- Set `CORS_ORIGINS` to any additional allowed frontend origins, comma-separated.
- Configure Supabase frontend keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) for web auth/cloud save.
- Configure Supabase Edge Function secrets for Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_CLIENT_URL`).
- Deploy Supabase Stripe functions (`stripe-create-checkout-session`, `stripe-sync-checkout-session`, `stripe-webhook`).
- Point Stripe webhook to Supabase function URL.
- Configure Google Play service account credentials on the backend/API if Android Google Play Billing is enabled.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Run `npm run mobile:sync` before opening native projects for a store build.
- For iOS App Store review, run `npm run mobile:sync:ios:appstore` instead of the generic mobile sync.
- Create the Android Play Console in-app products using the exact product IDs listed above before testing Google Play purchases.
- Test Stripe checkout plus webhook delivery through Supabase Edge Functions before enabling live payments.
- Test Google Play purchases in an Internal testing track before shipping Android production.
- Do not submit an iOS App Store build with Stripe coin/diamond purchases enabled unless Apple In-App Purchase/StoreKit has also been implemented.
- Verify microphone permission + blow trigger behavior on at least one Android phone and one Android tablet.
- Verify mobile control layout (`fly-left` and `fly-right`) on both landscape and portrait.
- Verify web keyboard controls still work after mobile updates.
