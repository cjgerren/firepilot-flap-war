import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase, hasSupabaseConfig } from '@/api/supabaseClient';
import {
  activateDeveloperProfile,
  deactivateDeveloperProfile,
  resetEconomyProgress,
} from '@/lib/gameStore';
import { hasOwnerAccessConfig, isOwnerUser } from '@/lib/accessControl';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';
import { isIosAppStoreBuild } from '@/lib/releaseConfig';

const AuthContext = createContext();
const DEV_USER_KEY = 'fp_dev_user';
const DEV_LOGIN_EMAIL = 'dev@firepilot.local';
const isDeveloperLoginEnabled =
  import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true' && !isIosAppStoreBuild;

function getStoredDeveloperUser() {
  if (!isDeveloperLoginEnabled) {
    try {
      localStorage.removeItem(DEV_USER_KEY);
    } catch {}
    return null;
  }

  try {
    const raw = localStorage.getItem(DEV_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function storeDeveloperUser(user) {
  try {
    localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));
  } catch {}
}

function clearStoredDeveloperUser() {
  try {
    localStorage.removeItem(DEV_USER_KEY);
  } catch {}
}

function clearDeveloperSession() {
  clearStoredDeveloperUser();
  deactivateDeveloperProfile();
}

function buildDeveloperUser() {
  return {
    id: 'local-dev-firepilot',
    email: DEV_LOGIN_EMAIL,
    role: 'developer',
    isLocalDeveloper: true,
  };
}

function getUrlAuthParam(name) {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : '');
  return url.searchParams.get(name) || hashParams.get(name);
}

function cleanPasswordRecoveryUrl() {
  const url = new URL(window.location.href);
  [
    'access_token',
    'expires_at',
    'expires_in',
    'refresh_token',
    'token_type',
    'type',
    'code',
    'token_hash',
    'error',
    'error_code',
    'error_description',
  ].forEach((param) => url.searchParams.delete(param));
  url.hash = '';
  window.history.replaceState(window.history.state, '', url.toString());
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const isOwnerAccount = Boolean(user && isOwnerUser(user));

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setIsLoadingAuth(true);
      setAuthError(null);

      const localDeveloperUser = getStoredDeveloperUser();

      if (!hasSupabaseConfig || !supabase) {
        if (localDeveloperUser) {
          activateDeveloperProfile();
          if (mounted) {
            setUser(localDeveloperUser);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
          }
          return;
        }

        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('Supabase getSession error:', error);
          setUser(null);
          setIsAuthenticated(false);
        } else {
          const currentUser = data?.session?.user ?? null;
          if (currentUser) {
            clearDeveloperSession();
          } else if (localDeveloperUser) {
            activateDeveloperProfile();
            setUser(localDeveloperUser);
            setIsAuthenticated(true);
            return;
          }
          setUser(currentUser);
          setIsAuthenticated(!!currentUser);
        }
      } catch (error) {
        if (!mounted) return;
        console.error('Unexpected auth init error:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    initAuth();

    if (!hasSupabaseConfig || !supabase) {
      return () => {
        mounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      if (currentUser) {
        clearDeveloperSession();
      }
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      setIsLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAppState = async () => {
    setAuthError(null);

    if (!hasSupabaseConfig || !supabase) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Supabase checkAppState error:', error);
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      const currentUser = data?.session?.user ?? null;
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
    } catch (error) {
      console.error('Unexpected checkAppState error:', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const login = async (email, password) => {
    setAuthError(null);

    if (!hasSupabaseConfig || !supabase) {
      const error = new Error('Supabase auth is not configured for this installation.');
      setAuthError({
        type: 'config_error',
        message: error.message,
      });
      throw error;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError({
        type: 'login_error',
        message: error.message,
      });
      throw error;
    }

    const currentUser = data?.user ?? null;
    if (currentUser) {
      clearDeveloperSession();
    }
    setUser(currentUser);
    setIsAuthenticated(!!currentUser);
    return data;
  };

  const register = async (email, password) => {
    setAuthError(null);

    if (!hasSupabaseConfig || !supabase) {
      const error = new Error('Supabase auth is not configured for this installation.');
      setAuthError({
        type: 'config_error',
        message: error.message,
      });
      throw error;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthError({
        type: 'register_error',
        message: error.message,
      });
      throw error;
    }

    const currentUser = data?.user ?? null;
    if (currentUser) {
      clearDeveloperSession();
    }
    setUser(currentUser);
    setIsAuthenticated(!!currentUser);
    return data;
  };

  const requestPasswordReset = async (email) => {
    setAuthError(null);

    if (!hasSupabaseConfig || !supabase) {
      const error = new Error('Supabase auth is not configured for this installation.');
      setAuthError({
        type: 'config_error',
        message: error.message,
      });
      throw error;
    }

    const redirectTo = `${window.location.origin}/login?mode=reset`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setAuthError({
        type: 'password_reset_error',
        message: error.message,
      });
      throw error;
    }

    return data;
  };

  const preparePasswordRecovery = useCallback(async () => {
    setAuthError(null);

    if (!hasSupabaseConfig || !supabase) {
      const error = new Error('Supabase auth is not configured for this installation.');
      setAuthError({
        type: 'config_error',
        message: error.message,
      });
      throw error;
    }

    const authUrlError = getUrlAuthParam('error_description') || getUrlAuthParam('error');
    if (authUrlError) {
      cleanPasswordRecoveryUrl();
      const error = new Error(decodeURIComponent(authUrlError));
      setAuthError({
        type: 'password_recovery_error',
        message: error.message,
      });
      throw error;
    }

    const accessToken = getUrlAuthParam('access_token');
    const refreshToken = getUrlAuthParam('refresh_token');
    const code = getUrlAuthParam('code');
    const tokenHash = getUrlAuthParam('token_hash');

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setAuthError({
          type: 'password_recovery_error',
          message: error.message,
        });
        throw error;
      }

      cleanPasswordRecoveryUrl();
      const currentUser = data?.session?.user ?? null;
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      return data?.session;
    }

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setAuthError({
          type: 'password_recovery_error',
          message: error.message,
        });
        throw error;
      }

      cleanPasswordRecoveryUrl();
      const currentUser = data?.session?.user ?? null;
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      return data?.session;
    }

    if (tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });

      if (error) {
        setAuthError({
          type: 'password_recovery_error',
          message: error.message,
        });
        throw error;
      }

      cleanPasswordRecoveryUrl();
      const currentUser = data?.session?.user ?? null;
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      return data?.session;
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setAuthError({
        type: 'password_recovery_error',
        message: error.message,
      });
      throw error;
    }

    if (!data?.session) {
      const missingSessionError = new Error(
        'This reset link is missing a recovery session. Request a new reset link and open it in the same browser.'
      );
      setAuthError({
        type: 'password_recovery_error',
        message: missingSessionError.message,
      });
      throw missingSessionError;
    }

    return data.session;
  }, []);

  const updatePassword = async (password) => {
    setAuthError(null);

    if (!hasSupabaseConfig || !supabase) {
      const error = new Error('Supabase auth is not configured for this installation.');
      setAuthError({
        type: 'config_error',
        message: error.message,
      });
      throw error;
    }

    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setAuthError({
        type: 'password_update_error',
        message: error.message,
      });
      throw error;
    }

    const currentUser = data?.user ?? user ?? null;
    setUser(currentUser);
    setIsAuthenticated(!!currentUser);
    return data;
  };

  const logout = async () => {
    const hadDeveloperSession = Boolean(getStoredDeveloperUser());

    if (hadDeveloperSession) {
      clearDeveloperSession();
    }

    if (user?.isLocalDeveloper) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    if (!hasSupabaseConfig || !supabase) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout failed:', error);
      throw error;
    }

    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = (nextPath = '/', mode = 'login') => {
    const encodedNext = encodeURIComponent(nextPath || '/');
    const encodedMode = encodeURIComponent(mode || 'login');
    window.location.href = `/login?next=${encodedNext}&mode=${encodedMode}`;
  };

  const loginAsDeveloper = async () => {
    if (!isDeveloperLoginEnabled) {
      throw new Error('Local developer access is disabled for this build.');
    }

    const developerUser = buildDeveloperUser();
    activateDeveloperProfile();
    storeDeveloperUser(developerUser);
    setUser(developerUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return developerUser;
  };

  const clearLocalDeveloperState = async () => {
    const wasDeveloperUser = user?.isLocalDeveloper || Boolean(getStoredDeveloperUser());

    clearDeveloperSession();

    if (wasDeveloperUser) {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const deleteCurrentAccount = async (confirmPhrase) => {
    setAuthError(null);

    if (!hasSupabaseConfig || !supabase) {
      const error = new Error('Supabase auth is not configured for this installation.');
      setAuthError({
        type: 'config_error',
        message: error.message,
      });
      throw error;
    }

    if (!user || user.isLocalDeveloper) {
      const error = new Error('Sign in with a real account before requesting account deletion.');
      setAuthError({
        type: 'account_delete_error',
        message: error.message,
      });
      throw error;
    }

    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      const error = new Error('Missing API base URL for account deletion.');
      setAuthError({
        type: 'config_error',
        message: error.message,
      });
      throw error;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      const error = new Error(sessionError?.message || 'No active authenticated session found.');
      setAuthError({
        type: 'account_delete_error',
        message: error.message,
      });
      throw error;
    }

    const res = await fetch(`${apiBaseUrl}/account/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        confirmPhrase,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(
        data.message || data.error || 'Unable to delete your account right now.'
      );
      setAuthError({
        type: 'account_delete_error',
        message: error.message,
      });
      throw error;
    }

    clearDeveloperSession();
    resetEconomyProgress();

    try {
      await supabase.auth.signOut();
    } catch {
      // The auth user may already be gone after deletion.
    }

    setUser(null);
    setIsAuthenticated(false);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        hasSupabaseConfig,
        isDeveloperLoginEnabled,
        hasOwnerAccessConfig: hasOwnerAccessConfig(),
        isOwnerAccount,
        login,
        register,
        requestPasswordReset,
        preparePasswordRecovery,
        updatePassword,
        logout,
        loginAsDeveloper,
        clearLocalDeveloperState,
        deleteCurrentAccount,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
