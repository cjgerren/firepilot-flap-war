import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'cjgerren@gmail.com';
const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

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

export default function AccountDeletion() {
  const location = useLocation();
  const { user, isLoadingAuth, deleteCurrentAccount } = useAuth();
  const [confirmInput, setConfirmInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const loginPath = useMemo(() => {
    const next = encodeURIComponent(location.pathname);
    return `/login?next=${next}`;
  }, [location.pathname]);

  const handleDelete = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (confirmInput.trim() !== CONFIRMATION_PHRASE) {
      setErrorMessage(`Type ${CONFIRMATION_PHRASE} exactly to continue.`);
      return;
    }

    setStatus('submitting');

    try {
      await deleteCurrentAccount(CONFIRMATION_PHRASE);
      setStatus('success');
    } catch (error) {
      setStatus('idle');
      setErrorMessage(error?.message || 'Unable to delete your account right now.');
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-6 md:py-10" style={shellStyle}>
      <div className="mx-auto w-full max-w-3xl rounded-[32px] p-6 md:p-8" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <div
              className="font-mono text-[11px] tracking-[0.24em] mb-2"
              style={{ color: 'rgba(255,176,176,0.8)' }}
            >
              ACCOUNT DELETION
            </div>
            <h1
              className="font-display text-3xl md:text-4xl font-black tracking-[0.12em]"
              style={{ color: '#edf8ff' }}
            >
              DELETE FIREPILOT ACCOUNT
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/privacy"
              className="rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.16em]"
              style={{
                color: '#9ddcff',
                background: 'rgba(157,220,255,0.08)',
                border: '1px solid rgba(157,220,255,0.2)',
              }}
            >
              PRIVACY POLICY
            </Link>
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
          </div>
        </div>

        <div className="space-y-5 font-mono text-xs leading-6" style={{ color: 'rgba(225,235,242,0.78)' }}>
          <p>
            This page is the public account deletion path for FirePilot Flap War. Deleting your
            account permanently removes your cloud save and your authenticated profile from the app.
          </p>
          <p>
            This action is irreversible. If you only want to stop using the app on one device, do
            not use account deletion.
          </p>
        </div>

        {status === 'success' ? (
          <div
            className="mt-6 rounded-2xl px-4 py-4"
            style={{
              background: 'rgba(157,220,255,0.08)',
              border: '1px solid rgba(157,220,255,0.2)',
            }}
          >
            <div className="font-display text-base font-black tracking-[0.08em]" style={{ color: '#edf8ff' }}>
              ACCOUNT DELETED
            </div>
            <div className="font-mono text-xs leading-6 mt-2" style={{ color: 'rgba(225,235,242,0.78)' }}>
              Your authenticated account and cloud save have been removed from FirePilot Flap War.
            </div>
          </div>
        ) : isLoadingAuth ? (
          <div className="mt-6 font-mono text-xs" style={{ color: 'rgba(225,235,242,0.72)' }}>
            Checking session...
          </div>
        ) : user?.isLocalDeveloper ? (
          <div
            className="mt-6 rounded-2xl px-4 py-4"
            style={{
              background: 'rgba(255,199,133,0.08)',
              border: '1px solid rgba(255,199,133,0.2)',
            }}
          >
            <div className="font-display text-base font-black tracking-[0.08em]" style={{ color: '#edf8ff' }}>
              LOCAL DEVELOPER PROFILE
            </div>
            <div className="font-mono text-xs leading-6 mt-2" style={{ color: 'rgba(225,235,242,0.78)' }}>
              The current session is a local developer profile, not a cloud-backed account. To
              delete a real account, sign in with the account you want to remove.
            </div>
          </div>
        ) : user?.id ? (
          <form onSubmit={handleDelete} className="mt-6 space-y-4">
            <div
              className="rounded-2xl px-4 py-4"
              style={{
                background: 'rgba(255,120,120,0.08)',
                border: '1px solid rgba(255,120,120,0.2)',
              }}
            >
              <div className="font-display text-base font-black tracking-[0.08em]" style={{ color: '#edf8ff' }}>
                SIGNED IN AS
              </div>
              <div className="font-mono text-xs leading-6 mt-2" style={{ color: '#ffb0b0' }}>
                {user.email || user.id}
              </div>
            </div>

            <label className="block">
              <div className="font-mono text-[11px] tracking-[0.16em] mb-2" style={{ color: 'rgba(225,235,242,0.66)' }}>
                TYPE {CONFIRMATION_PHRASE}
              </div>
              <input
                type="text"
                value={confirmInput}
                onChange={(event) => setConfirmInput(event.target.value)}
                className="w-full rounded-2xl px-4 py-3 font-mono text-sm"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#edf8ff',
                }}
              />
            </label>

            {errorMessage && (
              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  background: 'rgba(255,120,120,0.08)',
                  border: '1px solid rgba(255,120,120,0.22)',
                  color: '#ffb0b0',
                }}
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="rounded-2xl px-5 py-3 font-display text-sm font-black tracking-[0.14em]"
              style={{
                background: 'rgba(255,120,120,0.12)',
                border: '1px solid rgba(255,120,120,0.3)',
                color: '#ffb0b0',
                opacity: status === 'submitting' ? 0.7 : 1,
              }}
            >
              {status === 'submitting' ? 'DELETING ACCOUNT...' : 'PERMANENTLY DELETE ACCOUNT'}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div
              className="rounded-2xl px-4 py-4"
              style={{
                background: 'rgba(157,220,255,0.08)',
                border: '1px solid rgba(157,220,255,0.2)',
              }}
            >
              <div className="font-mono text-xs leading-6" style={{ color: 'rgba(225,235,242,0.78)' }}>
                Sign in with the FirePilot account you want to delete, then return to this page to
                complete permanent deletion.
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={loginPath}
                className="rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.16em]"
                style={{
                  color: '#9ddcff',
                  background: 'rgba(157,220,255,0.08)',
                  border: '1px solid rgba(157,220,255,0.2)',
                }}
              >
                SIGN IN TO DELETE
              </Link>
              <a
                href={`mailto:${supportEmail}?subject=FirePilot%20account%20deletion%20request`}
                className="rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.16em]"
                style={{
                  color: 'rgba(225,235,242,0.78)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                EMAIL SUPPORT
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
