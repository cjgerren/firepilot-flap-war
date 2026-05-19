import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { pullCloudSaveToLocal } from '@/lib/cloudSave';
import { syncCheckoutSession } from '@/lib/payments';
import { areExternalPurchasesEnabled } from '@/lib/releaseConfig';
import Game from './pages/Game';
import Login from './pages/Login';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AccountDeletion from './pages/AccountDeletion';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  useEffect(() => {
    const syncAfterCheckout = async () => {
      if (!areExternalPurchasesEnabled) return;

      const params = new URLSearchParams(window.location.search);
      const checkout = params.get('checkout');
      const sessionId = params.get('session_id');

      if (checkout === 'success') {
        try {
          if (sessionId) {
            await syncCheckoutSession(sessionId);
          }

          await pullCloudSaveToLocal();
        } catch (err) {
          console.error('Post-checkout cloud sync failed:', err);
        } finally {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, '', cleanUrl);
          window.dispatchEvent(new Event('storage'));
        }
      }

      if (checkout === 'cancelled') {
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    };

    syncAfterCheckout();
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/account/delete" element={<AccountDeletion />} />
      <Route path="/" element={<Game />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
