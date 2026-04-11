import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, hasSupabaseConfig } from '@/api/supabaseClient';
import { activateDeveloperProfile, deactivateDeveloperProfile } from '@/lib/gameStore';

const AuthContext = createContext();
const DEV_USER_KEY = 'fp_dev_user';
const DEV_LOGIN_EMAIL = 'dev@firepilot.local';
const isDeveloperLoginEnabled = import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true';

function getStoredDeveloperUser() {
  if (!isDeveloperLoginEnabled) {
    localStorage.removeItem(DEV_USER_KEY);
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
  localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));
}

function clearStoredDeveloperUser() {
  localStorage.removeItem(DEV_USER_KEY);
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

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
        login,
        register,
        logout,
        loginAsDeveloper,
        clearLocalDeveloperState,
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
