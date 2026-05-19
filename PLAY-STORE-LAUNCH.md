# FirePilot Google Play Launch Checklist

Use this as the source of truth for launch. Only check an item when it is actually verified.

## Repo-Verified Status

- [x] Android package name is `com.cjgerren.firepilottunnelrun`.
- [x] Android target SDK is `36`.
- [x] Google Play Billing code exists in the Android app.
- [x] Google Play purchase verification route exists in the backend.
- [x] Public privacy policy route exists in the app.
- [x] Public account deletion route exists in the app.
- [x] Signed Android release bundle exists at `android/app/build/outputs/bundle/release/app-release.aab`.
- [x] Backend exposes account deletion API routes.
- [ ] Production `VITE_API_BASE_URL` is confirmed and deployed.
- [ ] Production Supabase frontend credentials are confirmed.
- [ ] Production Supabase backend service credentials are confirmed.
- [ ] Production Google Play service account credentials are confirmed on the backend.
- [ ] Hosted production privacy policy URL is live.
- [ ] Hosted production account deletion URL is live.
- [ ] Release microphone disclosure flow is manually verified on Android.
- [ ] Account deletion is manually verified against production Supabase.

## Env Audit

These are the variables the code actually reads for launch-related behavior.

### Frontend `.env`

- [x] `VITE_API_BASE_URL`
  Current local value points at `https://firepilotwar.com/api`.
- [x] `VITE_SUPABASE_URL`
  Current local value is set.
- [x] `VITE_SUPABASE_ANON_KEY`
  Current local value is set.
- [x] `VITE_ENABLE_DEV_LOGIN`
  Current local value is `false`.
- [x] `VITE_OWNER_EMAILS`
  Current local value is set.
- [x] `VITE_OWNER_USER_IDS`
  Current local value is set.
- [ ] `VITE_SUPPORT_EMAIL`
  Optional for launch because the app falls back to `cjgerren@gmail.com`, but it should still be set explicitly for production.
- [ ] `VITE_RELEASE_PLATFORM`
  Not needed for the Android Play build.
- [ ] `VITE_IOS_APP_STORE_BUILD`
  Not needed for the Android Play build.
- [ ] `VITE_DISABLE_EXTERNAL_PURCHASES`
  Leave unset for Android if Google Play purchases should stay enabled.

### Backend `backend/.env`

- [x] `PORT`
  Current local value is set.
- [x] `CLIENT_URL`
  Current local value is `https://firepilotwar.com`.
- [ ] `CORS_ORIGINS`
  Optional if the built-in allowlist covers every production origin you use, but it should be set if you serve the frontend from any additional domain.
- [x] `SUPABASE_URL`
  Current local value is set.
- [x] `SUPABASE_SERVICE_ROLE_KEY`
  Current local value is set.
- [x] `GOOGLE_PLAY_PACKAGE_NAME`
  Current local value is set.
- [x] `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
  Current local value is set.
- [x] `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
  Current local value is set.
- [ ] `STRIPE_SECRET_KEY`
  Present locally, but Stripe is not a blocker for Google Play Android launch.
- [ ] `STRIPE_WEBHOOK_SECRET`
  Present locally, but Stripe is not a blocker for Google Play Android launch.
- [ ] `STRIPE_APP_NAME`
  Optional because the backend defaults to `FirePilot`.

### Launch-Critical Env Summary

- [x] Frontend auth and API base variables are present locally.
- [x] Backend local `CLIENT_URL` has been changed from localhost.
- [x] Backend local Google Play variables have been added.
- [ ] Production env values still need to be verified in the actual deployed environment, not just local files.

### Exact Backend Values To Set

Use these exact non-secret values:

```env
CLIENT_URL=https://firepilotwar.com
GOOGLE_PLAY_PACKAGE_NAME=com.cjgerren.firepilottunnelrun
```

Fill in these exact placeholders with your real Google service account credentials from the Play Developer API service account:

```env
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

Notes:

- The private key must be stored as a single env var string with `\n` escapes between lines.
- These values must exist in the deployed backend environment, not just local files.
- `CLIENT_URL` must match the production frontend origin that receives checkout redirects.

### Google Play Service Account Setup

Follow this exact order:

1. Create or choose a Google Cloud project for FirePilot.
2. In Google Cloud, enable the Google Play Developer API for that project.
3. In Google Cloud, create a service account.
4. In Play Console, go to Users and permissions and invite the service account email as a user.
5. Grant the service account the minimum permissions needed for billing API access:
   - View financial data, orders, and cancellation survey responses
   - Manage orders and subscriptions
6. In Google Cloud, create a JSON key for that service account.
7. Copy the service account email into `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`.
8. Copy the private key into `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` as a single line with `\n` escapes.
9. Add both values to the deployed backend environment.
10. Restart or redeploy the backend after the env vars are added.

Do not commit the JSON key file or raw private key into the repo.

## Do Today

- [ ] Confirm production frontend env values.
  Local values exist for `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`, but they still need to be verified in the deployed frontend.
- [ ] Confirm production backend env values.
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist locally, but `CLIENT_URL` is still localhost and the Google Play backend vars are currently missing locally.
- [ ] Keep `VITE_ENABLE_DEV_LOGIN=false` for the release build.
- [ ] Publish the privacy policy page on the production domain.
- [ ] Publish the account deletion page on the production domain.
- [ ] Verify the production backend is reachable from the app.
- [ ] Verify account deletion works end to end in production.
- [ ] Decide the release app name shown in Google Play.
- [ ] Prepare the store listing copy.
  Need app name, short description, full description, contact email, and website.
- [ ] Prepare store assets.
  Need icon, feature graphic, and phone screenshots.
- [ ] Record the next release version plan.
  Current Android values are `versionCode 1` and `versionName 1.0`.

## Play Console

- [ ] Create or finish the Play Console app for `com.cjgerren.firepilottunnelrun`.
- [ ] Enroll in Play App Signing.
- [ ] Set up the payments profile.
- [ ] Add bank payout information.
- [ ] Complete the Play store listing.
- [ ] Complete App content.
  Need privacy policy URL, Data safety, data deletion answers, ads declaration, content rating, and target audience.
- [ ] Create all one-time products in Play Console.
  Required IDs:
  `coins_100`
  `coins_200`
  `coins_500`
  `coins_1200`
  `coins_2500`
  `coins_3000`
  `coins_4000`
  `coins_5000`
  `coins_10000`
  `diamonds_10`
  `diamonds_25`
  `diamonds_75`
  `diamonds_150`
  `diamonds_300`
- [ ] Upload the signed `.aab` to Internal testing.

## Testing

- [ ] Add your Google account as an internal tester.
- [ ] Add your Google account as a Play license tester.
- [ ] Install the Play-distributed internal test build.
- [ ] Verify sign up and sign in.
- [ ] Verify cloud save pull and push.
- [ ] Verify gameplay and orientation behavior.
- [ ] Verify microphone disclosure and permission flow.
- [ ] Verify Google Play coin purchase flow.
- [ ] Verify Google Play diamond purchase flow.
- [ ] Verify currency sync after reinstall.
- [ ] Verify account deletion from the production build.
- [ ] Review the Play pre-launch report for newer Android devices.
- [ ] Fix every blocking issue found in internal testing or the pre-launch report.

## Possible Google Gate

- [ ] Confirm whether this Play developer account requires closed testing before production.
- [ ] If required, create a Closed testing track.
- [ ] If required, recruit at least 12 opted-in testers.
- [ ] If required, keep them opted in for 14 consecutive days.
- [ ] If required, apply for production access after the closed test requirement is satisfied.

## Production Release

- [ ] Increment `versionCode` before each new Play upload after the first one.
- [ ] Promote the tested release toward production.
- [ ] Monitor login, save sync, billing verification, and crash reports after launch.

## Current Best Next Sequence

1. Confirm production env values.
2. Host the privacy policy and account deletion pages.
3. Verify account deletion against production.
4. Create the Play Console app and enroll in Play App Signing.
5. Create the Play product catalog.
6. Upload the current `.aab` to Internal testing.
7. Test the Play-installed build and review the pre-launch report.
8. Determine whether closed testing is required for this developer account.
