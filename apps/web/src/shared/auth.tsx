import type { SignInOutput } from 'aws-amplify/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

const enabled = import.meta.env.VITE_AUTH_REQUIRED === 'true';
const issuer = import.meta.env.VITE_COGNITO_ISSUER?.trim();
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();
const userPoolId = issuer?.split('/').filter(Boolean).at(-1);

if (enabled && (!issuer || !clientId || !userPoolId)) {
  throw new Error('AWS authentication is enabled but Cognito configuration is incomplete.');
}

let cognitoAuthPromise: Promise<typeof import('aws-amplify/auth')> | undefined;
function getCognitoAuth() {
  if (!enabled || !clientId || !userPoolId) throw new Error('AWS authentication is not configured.');
  cognitoAuthPromise ??= Promise.all([
    import('aws-amplify'),
    import('aws-amplify/auth'),
    import('aws-amplify/auth/cognito'),
    import('aws-amplify/utils'),
  ]).then(([amplify, auth, cognito, utils]) => {
    amplify.Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId: clientId,
          loginWith: { username: true },
          mfa: { status: 'optional', totpEnabled: true, smsEnabled: false },
        },
      },
    });
    // Keep the authenticated session scoped to this browser tab, like the old PKCE flow.
    cognito.cognitoUserPoolsTokenProvider.setKeyValueStorage(utils.sessionStorage);
    return auth;
  }).catch((error: unknown) => {
    cognitoAuthPromise = undefined;
    throw error;
  });
  return cognitoAuthPromise;
}

type SignedInUser = { username: string; userId: string };

type AuthState = {
  enabled: boolean;
  loading: boolean;
  user: SignedInUser | null;
  isAdmin: boolean;
  signIn: (username: string, password: string) => Promise<SignInOutput>;
  confirmSignIn: (challengeResponse: string) => Promise<SignInOutput>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  fetchMFAPreference: () => Promise<{ enabled?: string[]; preferred?: string }>;
  beginTOTPSetup: () => Promise<{ sharedSecret: string; setupUri: string }>;
  confirmTOTPSetup: (code: string) => Promise<void>;
  disableTOTP: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function isAdministrator(groups: unknown): boolean {
  return Array.isArray(groups) && groups.includes('administrators');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(!enabled);
  const [loading, setLoading] = useState(enabled);

  const refreshUser = useCallback(async () => {
    if (!enabled) {
      setUser(null);
      setIsAdmin(true);
      setLoading(false);
      return true;
    }

    try {
      const auth = await getCognitoAuth();
      const [session, current] = await Promise.all([auth.fetchAuthSession(), auth.getCurrentUser()]);
      const accessToken = session.tokens?.accessToken;
      if (!accessToken) throw new Error('No active Cognito session');
      const admin = isAdministrator(accessToken.payload['cognito:groups']);
      setUser({ username: current.username, userId: current.userId });
      setIsAdmin(admin);
      setLoading(false);
      return admin;
    } catch {
      setUser(null);
      setIsAdmin(false);
      setLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const signIn = useCallback(async (username: string, password: string) => {
    if (!enabled) throw new Error('AWS authentication is not enabled in this environment.');
    const auth = await getCognitoAuth();
    return auth.signIn({ username, password });
  }, []);

  const confirmSignIn = useCallback(async (challengeResponse: string) => {
    const auth = await getCognitoAuth();
    return auth.confirmSignIn({ challengeResponse });
  }, []);

  const signOut = useCallback(async () => {
    if (enabled) {
      const auth = await getCognitoAuth();
      await auth.signOut();
    }
    setUser(null);
    setIsAdmin(!enabled);
  }, []);

  const fetchMFAPreference = useCallback(async () => {
    const auth = await getCognitoAuth();
    return auth.fetchMFAPreference();
  }, []);

  const beginTOTPSetup = useCallback(async () => {
    const auth = await getCognitoAuth();
    const setup = await auth.setUpTOTP();
    return {
      sharedSecret: setup.sharedSecret,
      setupUri: setup.getSetupUri('InvestorOS', user?.username ?? 'admin').toString(),
    };
  }, [user?.username]);

  const confirmTOTPSetup = useCallback(async (code: string) => {
    const auth = await getCognitoAuth();
    await auth.verifyTOTPSetup({ code });
    await auth.updateMFAPreference({ totp: 'PREFERRED' });
  }, []);

  const disableTOTP = useCallback(async () => {
    const auth = await getCognitoAuth();
    await auth.updateMFAPreference({ totp: 'DISABLED' });
  }, []);

  const value = useMemo<AuthState>(() => ({
    enabled,
    loading,
    user,
    isAdmin,
    signIn,
    confirmSignIn,
    signOut,
    refreshUser,
    fetchMFAPreference,
    beginTOTPSetup,
    confirmTOTPSetup,
    disableTOTP,
  }), [loading, user, isAdmin, signIn, confirmSignIn, signOut, refreshUser, fetchMFAPreference, beginTOTPSetup, confirmTOTPSetup, disableTOTP]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

export function RequireAdmin() {
  const { enabled: authEnabled, loading, user, isAdmin } = useAuth();
  const location = useLocation();
  if (authEnabled && loading) return <div className="app-loading" role="status">Vérification de votre accès…</div>;
  if (authEnabled && !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (authEnabled && !isAdmin) return <main className="auth-denied"><h1>Accès réservé</h1><p>Ce compte n’est pas membre des administrateurs InvestorOS.</p></main>;
  return <Outlet />;
}

/** Kept as a route for old links; direct Cognito sign-in no longer needs an OAuth callback. */
export function AuthCallback() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void refreshUser().then((admin) => {
      if (!active) return;
      if (admin) navigate('/app', { replace: true });
      else setError('Votre connexion a expiré. Recommencez depuis la page de connexion.');
    });
    return () => { active = false; };
  }, [refreshUser, navigate]);

  return <main className="app-loading" role={error ? 'alert' : 'status'}>{error || 'Vérification de votre session…'}</main>;
}

export async function getAccessToken(): Promise<string | undefined> {
  if (!enabled) return undefined;
  const auth = await getCognitoAuth();
  const session = await auth.fetchAuthSession();
  const token = session.tokens?.accessToken;
  if (!token) {
    window.location.assign('/login');
    throw new Error('Votre session administrateur a expiré. Reconnectez-vous.');
  }
  if (!isAdministrator(token.payload['cognito:groups'])) {
    throw new Error('Ce compte n’est pas membre des administrateurs InvestorOS.');
  }
  return token.toString();
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (enabled && response.status === 401) {
    const auth = await getCognitoAuth();
    await auth.signOut();
    window.location.assign('/login');
  }
  return response;
}
