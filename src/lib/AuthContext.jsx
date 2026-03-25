import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

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

      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('Supabase getSession error:', error);
          setUser(null);
          setIsAuthenticated(false);
        } else {
          const currentUser = data?.session?.user ?? null;
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
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
    setUser(currentUser);
    setIsAuthenticated(!!currentUser);
    return data;
  };

  const register = async (email, password) => {
    setAuthError(null);

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
    setUser(currentUser);
    setIsAuthenticated(!!currentUser);
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout failed:', error);
      throw error;
    }

    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
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
        login,
        register,
        logout,
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