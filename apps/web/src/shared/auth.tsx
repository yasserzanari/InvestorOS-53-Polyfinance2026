import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts';

const enabled = import.meta.env.VITE_AUTH_REQUIRED === 'true';
const issuer = import.meta.env.VITE_COGNITO_ISSUER?.trim();
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();
const hostedDomain = import.meta.env.VITE_COGNITO_DOMAIN?.trim();

if (enabled && (!issuer || !clientId || !hostedDomain)) {
  throw new Error('AWS authentication is enabled but Cognito configuration is incomplete.');
}

let manager: UserManager | undefined;
function getManager() {
  if (!enabled || !issuer || !clientId || !hostedDomain) throw new Error('AWS authentication is not configured.');
  if (!manager) {
    const tabStorage = new WebStorageStateStore({ store: window.sessionStorage });
    manager = new UserManager({
      authority: issuer,
      client_id: clientId,
      client_authentication: 'client_secret_post',
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: `${window.location.origin}/login`,
      response_type: 'code',
      scope: 'openid',
      userStore: tabStorage,
      stateStore: tabStorage,
      automaticSilentRenew: false,
      monitorSession: false,
      loadUserInfo: false,
      filterProtocolClaims: true,
      refreshTokenAllowedScope: 'openid',
      metadata: {
        issuer,
        authorization_endpoint: `https://${hostedDomain}/oauth2/authorize`,
        token_endpoint: `https://${hostedDomain}/oauth2/token`,
        end_session_endpoint: `https://${hostedDomain}/logout`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
      },
    });
  }
  return manager;
}

function accessTokenGroups(accessToken: string): string[] {
  try {
    const encoded = accessToken.split('.')[1];
    if (!encoded) return [];
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as Record<string, unknown>;
    const groups = payload['cognito:groups'];
    return Array.isArray(groups) ? groups.filter((group): group is string => typeof group === 'string') : [];
  } catch {
    return [];
  }
}

type AuthState = {
  enabled: boolean;
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  completeSignIn: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refreshUser = useCallback(async () => {
    if (!enabled) {
      setUser(null);
      setLoading(false);
      return;
    }
    const next = await getManager().getUser();
    setUser(next && !next.expired ? next : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshUser().catch(() => setLoading(false));
  }, [refreshUser]);

  const signIn = useCallback(async () => {
    await getManager().signinRedirect();
  }, []);

  const completeSignIn = useCallback(async () => {
    await getManager().signinRedirectCallback();
    await refreshUser();
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    if (!enabled) return;
    await getManager().removeUser();
    if (!clientId || !hostedDomain) return;
    const logout = new URL(`https://${hostedDomain}/logout`);
    logout.searchParams.set('client_id', clientId);
    logout.searchParams.set('logout_uri', `${window.location.origin}/login`);
    window.location.assign(logout.toString());
  }, []);

  const value = useMemo<AuthState>(() => ({
    enabled,
    loading,
    user,
    isAdmin: !enabled || Boolean(user && accessTokenGroups(user.access_token).includes('administrators')),
    signIn,
    signOut,
    completeSignIn,
    refreshUser,
  }), [loading, user, signIn, signOut, completeSignIn, refreshUser]);

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

export function AuthCallback() {
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void completeSignIn().then(() => {
      if (active) navigate('/app', { replace: true });
    }).catch(() => {
      if (active) setError('La connexion a échoué. Recommencez depuis la page de connexion.');
    });
    return () => { active = false; };
  }, [completeSignIn, navigate]);

  return <main className="app-loading" role={error ? 'alert' : 'status'}>{error || 'Connexion sécurisée…'}</main>;
}

export async function getAccessToken(): Promise<string | undefined> {
  if (!enabled) return undefined;
  const oidc = getManager();
  let user = await oidc.getUser();
  if (!user) {
    window.location.assign('/login');
    throw new Error('Votre session administrateur a expiré. Reconnectez-vous.');
  }
  if (user.expired || (typeof user.expires_in === 'number' && user.expires_in <= 60)) {
    try {
      user = await oidc.signinSilent() ?? null;
    } catch {
      user = null;
    }
  }
  if (!user) {
    await oidc.removeUser();
    window.location.assign('/login');
    throw new Error('Votre session administrateur a expiré. Reconnectez-vous.');
  }
  if (!accessTokenGroups(user.access_token).includes('administrators')) {
    throw new Error('Ce compte n’est pas membre des administrateurs InvestorOS.');
  }
  return user.access_token;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (enabled && response.status === 401) {
    await getManager().removeUser();
    window.location.assign('/login');
  }
  return response;
}
