import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, AlertTriangle, ArrowLeft, Sparkles, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { areExternalPurchasesEnabled } from '@/lib/releaseConfig';

function stopAuthKeyPropagation(event) {
  event.stopPropagation();
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    register,
    requestPasswordReset,
    preparePasswordRecovery,
    updatePassword,
    loginAsDeveloper,
    isAuthenticated,
    isLoadingAuth,
    authError,
    hasSupabaseConfig,
    isDeveloperLoginEnabled,
  } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitInfo, setSubmitInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSessionStatus, setResetSessionStatus] = useState('idle');

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    return next || '/';
  }, [location.search]);

  const requestedMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('mode');
    return ['register', 'forgot', 'reset'].includes(value) ? value : 'login';
  }, [location.search]);

  const isForgotMode = mode === 'forgot';
  const isResetMode = mode === 'reset';
  const isPasswordMode = mode === 'login' || mode === 'register';
  const titleText = {
    login: 'SIGN IN',
    register: 'REGISTER',
    forgot: 'RESET PASSWORD',
    reset: 'NEW PASSWORD',
  }[mode];
  const introText = {
    login: areExternalPurchasesEnabled
      ? 'Authenticate to unlock Stripe checkout and attach purchases to your save.'
      : 'Authenticate to attach cloud progress to your pilot profile.',
    register: 'Create an account so purchases and cloud progress can be tied to your pilot profile.',
    forgot: 'Enter your account email and Firepilot will send a password reset link.',
    reset: 'Choose a new password for this pilot profile.',
  }[mode];

  useEffect(() => {
    setMode(requestedMode);
    setPassword('');
    setPasswordConfirm('');
    setSubmitError('');
    setSubmitInfo('');
    setResetSessionStatus('idle');
  }, [requestedMode]);

  useEffect(() => {
    if (!isResetMode || !hasSupabaseConfig) {
      return;
    }

    let active = true;

    const prepareReset = async () => {
      setResetSessionStatus('loading');
      setSubmitError('');

      try {
        await preparePasswordRecovery();

        if (!active) return;
        setResetSessionStatus('ready');
      } catch (error) {
        if (!active) return;
        setResetSessionStatus('error');
        setSubmitError(error?.message || 'This reset link is invalid or expired.');
      }
    };

    prepareReset();

    return () => {
      active = false;
    };
  }, [hasSupabaseConfig, isResetMode, preparePasswordRecovery]);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && !isResetMode) {
      navigate(nextPath, { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, isResetMode, navigate, nextPath]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPassword('');
    setPasswordConfirm('');
    setSubmitError('');
    setSubmitInfo('');
    setResetSessionStatus('idle');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitInfo('');

    if (!email.trim() && !isResetMode) {
      setSubmitError('Enter your email address.');
      return;
    }

    if (isPasswordMode && !password.trim()) {
      setSubmitError('Enter both email and password.');
      return;
    }

    if (isResetMode) {
      if (!password.trim() || !passwordConfirm.trim()) {
        setSubmitError('Enter and confirm your new password.');
        return;
      }

      if (password !== passwordConfirm) {
        setSubmitError('The new passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isForgotMode) {
        await requestPasswordReset(email.trim());
        setSubmitInfo('If that email has a Firepilot account, a reset link is on the way.');
        return;
      }

      if (isResetMode) {
        if (resetSessionStatus !== 'ready') {
          setSubmitError('Open the reset link from your email before setting a new password.');
          return;
        }

        await updatePassword(password);
        setSubmitInfo('Password updated. Returning to Firepilot.');
        navigate(nextPath, { replace: true });
        return;
      }

      if (mode === 'login') {
        await login(email.trim(), password);
        navigate(nextPath, { replace: true });
        return;
      }

      const result = await register(email.trim(), password);
      const hasSession = Boolean(result?.session);

      if (hasSession) {
        navigate(nextPath, { replace: true });
        return;
      }

      setSubmitInfo(
        'Account created. If your Supabase project requires email confirmation, verify your email and then sign in.'
      );
      setMode('login');
    } catch (error) {
      setSubmitError(error?.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeveloperAccess = async () => {
    setSubmitError('');
    setSubmitInfo('');
    setIsSubmitting(true);

    try {
      await loginAsDeveloper();
      navigate(nextPath, { replace: true });
    } catch (error) {
      setSubmitError(error?.message || 'Developer access failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background:
          'radial-gradient(circle at top, rgba(125,227,255,0.14), rgba(0,0,0,0) 28%), radial-gradient(circle at 80% 18%, rgba(255,174,128,0.1), rgba(0,0,0,0) 22%), linear-gradient(180deg, #09131b 0%, #081019 40%, #05080c 100%)',
      }}
    >
      <div
        className="w-full max-w-md rounded-[32px] p-6 md:p-7"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,18,26,0.94), rgba(7,11,16,0.98)), radial-gradient(circle at top right, rgba(106,170,214,0.18), rgba(0,0,0,0) 35%)',
          border: '1px solid rgba(175,225,255,0.16)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] tracking-[0.2em]"
            style={{
              color: 'rgba(225,235,242,0.72)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            RETURN
          </Link>

          <div
            className="font-mono text-[10px] tracking-[0.24em]"
            style={{ color: 'rgba(157,220,255,0.74)' }}
          >
            AUTH ACCESS
          </div>
        </div>

        <div className="mb-6">
          <h1
            className="font-display text-3xl font-black tracking-[0.16em]"
            style={{ color: '#edf8ff' }}
          >
            {titleText}
          </h1>
          <p
            className="font-mono text-xs leading-5 mt-3"
            style={{ color: 'rgba(225,235,242,0.66)' }}
          >
            {introText}
          </p>
        </div>

        {isDeveloperLoginEnabled && (
          <div
            className="rounded-2xl px-4 py-4 mb-5"
            style={{
              background: 'rgba(255,199,133,0.07)',
              border: '1px solid rgba(255,199,133,0.18)',
            }}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 mt-0.5" style={{ color: '#ffc785' }} />
              <div className="flex-1">
                <div
                  className="font-mono text-[11px] tracking-wider mb-1"
                  style={{ color: '#ffc785' }}
                >
                  LOCAL DEVELOPER ACCESS
                </div>
                <div
                  className="font-mono text-xs leading-5 mb-3"
                  style={{ color: 'rgba(255,255,255,0.72)' }}
                >
                  Instant local sign-in with every unlock, infinite coins, and infinite diamonds.
                </div>
                <button
                  type="button"
                  onClick={handleDeveloperAccess}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-[0.18em] transition-all disabled:cursor-not-allowed"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,199,133,0.2), rgba(157,220,255,0.12))',
                    border: '1px solid rgba(255,199,133,0.32)',
                    color: '#edf8ff',
                    opacity: isSubmitting ? 0.62 : 1,
                  }}
                >
                  ENTER DEVELOPER PROFILE
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-wider transition-all"
            style={{
              background: mode === 'login' ? 'rgba(157,220,255,0.14)' : 'rgba(255,255,255,0.03)',
              border:
                mode === 'login'
                  ? '1px solid rgba(157,220,255,0.38)'
                  : '1px solid rgba(255,255,255,0.08)',
              color: mode === 'login' ? '#9ddcff' : 'rgba(225,235,242,0.7)',
            }}
          >
            <span className="inline-flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              SIGN IN
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchMode('register')}
            className="rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-wider transition-all"
            style={{
              background: mode === 'register' ? 'rgba(255,199,133,0.12)' : 'rgba(255,255,255,0.03)',
              border:
                mode === 'register'
                  ? '1px solid rgba(255,199,133,0.34)'
                  : '1px solid rgba(255,255,255,0.08)',
              color: mode === 'register' ? '#ffc785' : 'rgba(225,235,242,0.7)',
            }}
          >
            <span className="inline-flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              REGISTER
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => switchMode(isForgotMode ? 'login' : 'forgot')}
          className="w-full rounded-2xl px-4 py-3 mb-5 font-display text-xs font-bold tracking-[0.16em] transition-all"
          style={{
            background: isForgotMode ? 'rgba(157,220,255,0.14)' : 'rgba(255,255,255,0.03)',
            border: isForgotMode
              ? '1px solid rgba(157,220,255,0.38)'
              : '1px solid rgba(255,255,255,0.08)',
            color: isForgotMode ? '#9ddcff' : 'rgba(225,235,242,0.72)',
          }}
        >
          <span className="inline-flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            {isForgotMode ? 'BACK TO SIGN IN' : 'FORGOT PASSWORD'}
          </span>
        </button>

        {!hasSupabaseConfig && (
          <div
            className="rounded-2xl px-4 py-3 mb-4"
            style={{
              background: 'rgba(255,171,122,0.08)',
              border: '1px solid rgba(255,171,122,0.22)',
            }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: '#ffbb92' }} />
              <div>
                <div
                  className="font-mono text-[11px] tracking-wider mb-1"
                  style={{ color: '#ffbb92' }}
                >
                  AUTH NOT CONFIGURED
                </div>
                <div
                  className="font-mono text-xs leading-5"
                  style={{ color: 'rgba(255,255,255,0.72)' }}
                >
                  Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the frontend environment before this screen can sign users in.
                </div>
              </div>
            </div>
          </div>
        )}

        {(submitError || authError?.message) && (
          <div
            className="rounded-2xl px-4 py-3 mb-4"
            style={{
              background: 'rgba(255,120,120,0.08)',
              border: '1px solid rgba(255,120,120,0.22)',
            }}
          >
            <div
              className="font-mono text-xs leading-5"
              style={{ color: '#ffb0b0' }}
            >
              {submitError || authError?.message}
            </div>
          </div>
        )}

        {submitInfo && (
          <div
            className="rounded-2xl px-4 py-3 mb-4"
            style={{
              background: 'rgba(157,220,255,0.08)',
              border: '1px solid rgba(157,220,255,0.22)',
            }}
          >
            <div
              className="font-mono text-xs leading-5"
              style={{ color: 'rgba(225,235,242,0.82)' }}
            >
              {submitInfo}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={stopAuthKeyPropagation} onKeyUp={stopAuthKeyPropagation} className="space-y-4">
          {!isResetMode && (
            <div>
              <label
                htmlFor="email"
                className="block font-mono text-[11px] tracking-wider mb-2"
                style={{ color: 'rgba(225,235,242,0.66)' }}
              >
                EMAIL
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={stopAuthKeyPropagation}
                onKeyUp={stopAuthKeyPropagation}
                autoComplete="email"
                className="w-full rounded-2xl px-4 py-3 font-mono text-sm"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#edf8ff',
                }}
              />
            </div>
          )}

          {!isForgotMode && (
          <div>
            <label
              htmlFor="password"
              className="block font-mono text-[11px] tracking-wider mb-2"
              style={{ color: 'rgba(225,235,242,0.66)' }}
            >
              {isResetMode ? 'NEW PASSWORD' : 'PASSWORD'}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={stopAuthKeyPropagation}
              onKeyUp={stopAuthKeyPropagation}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-2xl px-4 py-3 font-mono text-sm"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#edf8ff',
              }}
            />
          </div>
          )}

          {isResetMode && (
            <div>
              <label
                htmlFor="passwordConfirm"
                className="block font-mono text-[11px] tracking-wider mb-2"
                style={{ color: 'rgba(225,235,242,0.66)' }}
              >
                CONFIRM NEW PASSWORD
              </label>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                onKeyDown={stopAuthKeyPropagation}
                onKeyUp={stopAuthKeyPropagation}
                autoComplete="new-password"
                className="w-full rounded-2xl px-4 py-3 font-mono text-sm"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#edf8ff',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !hasSupabaseConfig ||
              (isResetMode && resetSessionStatus !== 'ready')
            }
            className="w-full rounded-2xl px-4 py-3 font-display text-sm font-bold tracking-[0.18em] transition-all disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(135deg, rgba(157,220,255,0.18), rgba(255,199,133,0.12))',
              border: '1px solid rgba(157,220,255,0.38)',
              color: '#edf8ff',
              opacity:
                isSubmitting ||
                !hasSupabaseConfig ||
                (isResetMode && resetSessionStatus !== 'ready')
                  ? 0.62
                  : 1,
            }}
          >
            {isSubmitting
              ? isForgotMode
                ? 'SENDING LINK...'
                : isResetMode
                  ? 'UPDATING PASSWORD...'
                  : mode === 'login'
                    ? 'SIGNING IN...'
                    : 'CREATING ACCOUNT...'
              : isForgotMode
                ? 'SEND RESET LINK'
                : isResetMode
                  ? resetSessionStatus === 'loading'
                    ? 'CHECKING RESET LINK...'
                    : 'UPDATE PASSWORD'
                  : mode === 'login'
                    ? 'SIGN IN'
                    : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div
          className="mt-5 pt-4 flex flex-wrap items-center gap-3 font-mono text-[11px] tracking-[0.14em]"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(225,235,242,0.56)',
          }}
        >
          <Link to="/privacy" style={{ color: '#9ddcff' }}>
            PRIVACY
          </Link>
          <Link to="/account/delete" style={{ color: '#ffb0b0' }}>
            ACCOUNT DELETION
          </Link>
        </div>
      </div>
    </div>
  );
}
