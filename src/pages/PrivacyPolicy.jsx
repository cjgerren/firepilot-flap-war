import React from 'react';
import { Link } from 'react-router-dom';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'cjgerren@gmail.com';

const shellStyle = {
  background:
    'radial-gradient(circle at top, rgba(125,227,255,0.14), rgba(0,0,0,0) 28%), radial-gradient(circle at 80% 18%, rgba(255,174,128,0.1), rgba(0,0,0,0) 22%), linear-gradient(180deg, #09131b 0%, #081019 40%, #05080c 100%)',
};

const cardStyle = {
  background:
    'linear-gradient(180deg, rgba(10,18,26,0.94), rgba(7,11,16,0.98)), radial-gradient(circle at top right, rgba(106,170,214,0.18), rgba(0,0,0,0) 35%)',
  border: '1px solid rgba(175,225,255,0.16)',
  boxShadow: '0 30px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
};

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2
        className="font-display text-lg font-black tracking-[0.12em]"
        style={{ color: '#edf8ff' }}
      >
        {title}
      </h2>
      <div
        className="font-mono text-xs leading-6 space-y-3"
        style={{ color: 'rgba(225,235,242,0.78)' }}
      >
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen px-4 py-8 md:px-6 md:py-10" style={shellStyle}>
      <div className="mx-auto w-full max-w-4xl rounded-[32px] p-6 md:p-8" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <div
              className="font-mono text-[11px] tracking-[0.24em] mb-2"
              style={{ color: 'rgba(157,220,255,0.74)' }}
            >
              PRIVACY POLICY
            </div>
            <h1
              className="font-display text-3xl md:text-4xl font-black tracking-[0.12em]"
              style={{ color: '#edf8ff' }}
            >
              FIREPILOT FLAP WAR
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.16em]"
              style={{
                color: 'rgba(225,235,242,0.78)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              RETURN TO GAME
            </Link>
            <Link
              to="/account/delete"
              className="rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.16em]"
              style={{
                color: '#ffb0b0',
                background: 'rgba(255,120,120,0.08)',
                border: '1px solid rgba(255,120,120,0.22)',
              }}
            >
              ACCOUNT DELETION
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          <Section title="What The Game Uses">
            <p>
              FirePilot Flap War can be played locally without an account. If you sign in, the
              game uses Supabase Authentication and cloud save storage so your progress can follow
              your account across devices.
            </p>
            <p>
              The Android version uses Google Play Billing for in-game currency purchases. The web
              version can use Stripe checkout for the same digital goods. The iOS App Store build
              disables external digital purchases.
            </p>
          </Section>

          <Section title="Data We Process">
            <p>
              If you create or use an account, the app may process your email address, Supabase user
              ID, cloud save data, and purchase history tied to your pilot profile.
            </p>
            <p>
              Purchase verification may process transaction identifiers such as Google Play purchase
              tokens, Google order IDs, Stripe checkout session IDs, and related product metadata.
            </p>
            <p>
              If you enable the optional mobile microphone control, the game accesses microphone
              input on-device to detect a short blow for the tunnel bomb action. That microphone
              signal is used locally for gameplay input and is not uploaded by the app.
            </p>
          </Section>

          <Section title="How Data Is Used">
            <p>
              Account and cloud save data are used to authenticate you, restore your progress, and
              sync purchased currency into your save.
            </p>
            <p>
              Payment metadata is used to verify purchases, prevent duplicate grants, and record
              transaction history tied to your account.
            </p>
          </Section>

          <Section title="Sharing">
            <p>
              The app relies on third-party services that process data as part of delivering the
              product: Supabase for authentication and cloud data, Google Play for Android billing,
              and Stripe for web checkout.
            </p>
            <p>
              The app does not include third-party advertising SDKs, mobile analytics SDKs, or
              in-app behavioral tracking libraries in the current build.
            </p>
          </Section>

          <Section title="Retention And Deletion">
            <p>
              Local save data remains on your device until you remove it, clear app storage, or
              delete your account. Cloud save and account data remain associated with your account
              until they are deleted.
            </p>
            <p>
              To request deletion from inside or outside the app, use the account deletion page at
              <span style={{ color: '#9ddcff' }}> /account/delete</span>. Signed-in users can
              permanently delete their account directly from that page.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For privacy or deletion questions, contact{' '}
              <a
                href={`mailto:${supportEmail}`}
                style={{ color: '#9ddcff' }}
              >
                {supportEmail}
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
