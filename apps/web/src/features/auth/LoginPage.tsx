import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MeshDriftBackground } from './MeshDriftBackground';
import { useAuth } from '../../shared/auth';
import './login-page.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [totpSetupUri, setTotpSetupUri] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpQr, setTotpQr] = useState('');
  const [step, setStep] = useState<'credentials' | 'new-password' | 'totp-setup' | 'totp'>('credentials');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const auth = useAuth();
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/app';

  useEffect(() => {
    let active = true;
    if (!totpSetupUri) {
      setTotpQr('');
      return;
    }
    void QRCode.toDataURL(totpSetupUri, { width: 176, margin: 1, color: { dark: '#172941', light: '#ffffff' } })
      .then((dataUrl) => { if (active) setTotpQr(dataUrl); })
      .catch(() => { if (active) setTotpQr(''); });
    return () => { active = false; };
  }, [totpSetupUri]);

  const handleAuthError = (error: unknown) => {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') return 'Nom d’utilisateur ou mot de passe incorrect.';
    if (name === 'CodeMismatchException' || name === 'EnableSoftwareTokenMFAException') return 'Ce code de vérification est invalide ou expiré.';
    if (name === 'TooManyRequestsException' || name === 'LimitExceededException') return 'Trop de tentatives. Attendez quelques minutes avant de réessayer.';
    return 'La connexion sécurisée n’a pas abouti. Vérifiez vos informations puis réessayez.';
  };

  const continueAuth = async (result: Awaited<ReturnType<typeof auth.signIn>>) => {
    setMessage('');
    switch (result.nextStep.signInStep) {
      case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
        setStep('new-password');
        return;
      case 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP': {
        const details = result.nextStep.totpSetupDetails;
        setTotpSecret(details.sharedSecret);
        setTotpSetupUri(details.getSetupUri('InvestorOS', username || 'admin').toString());
        setVerificationCode('');
        setStep('totp-setup');
        return;
      }
      case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
        setVerificationCode('');
        setStep('totp');
        return;
      case 'DONE': {
        const administrator = await auth.refreshUser();
        if (!administrator) {
          await auth.signOut();
          setMessage('Ce compte n’a pas accès à InvestorOS. Utilisez le compte administrateur fourni.');
          setStep('credentials');
          return;
        }
        setPassword('');
        setNewPassword('');
        navigate(returnTo, { replace: true });
        return;
      }
      default:
        setMessage('Ce parcours de connexion n’est pas disponible pour ce compte. Contactez l’administrateur.');
        setStep('credentials');
    }
  };

  const submitAwsCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await auth.signIn(username.trim(), password);
      setPassword('');
      await continueAuth(result);
    } catch (error) {
      setPassword('');
      setMessage(handleAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const submitAwsChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = step === 'new-password' ? newPassword : verificationCode.replace(/\s/g, '');
      const result = await auth.confirmSignIn(response);
      setNewPassword('');
      setVerificationCode('');
      await continueAuth(result);
    } catch (error) {
      setMessage(handleAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const cancelAwsChallenge = async () => {
    setBusy(true);
    try { await auth.signOut(); } catch { /* Return to the start even if Cognito has no completed session yet. */ }
    setStep('credentials');
    setPassword('');
    setNewPassword('');
    setVerificationCode('');
    setTotpSetupUri('');
    setTotpSecret('');
    setMessage('');
    setBusy(false);
  };

  const explainUnavailableLogin = () => {
    setMessage('La connexion à un compte personnel sera bientôt disponible. Vos champs ne sont pas envoyés.');
  };

  if (auth.enabled) {
    const challengeTitle = step === 'new-password'
      ? 'Choisissez votre mot de passe'
      : step === 'totp-setup'
        ? 'Configurez votre authentificateur'
        : step === 'totp'
          ? 'Vérifiez votre identité'
          : 'Connexion sécurisée';
    return (
      <main className="login-page">
        <section className="login-art-panel" aria-label="InvestorOS">
          <MeshDriftBackground />
          <div className="login-art-wash" />
          <a className="login-brand" href="/" aria-label="InvestorOS, accueil">
            <img src="/brand/investoros-logo.png" alt="InvestorOS" />
          </a>
          <div className="login-art-copy">
            <h1>Votre capital mérite une meilleure boussole.</h1>
            <p>Un espace sécurisé pour analyser des objectifs, comparer des scénarios et suivre les décisions.</p>
          </div>
          <p className="login-art-foot">Accès réservé aux administrateurs autorisés.</p>
        </section>
        <section className="login-form-panel" aria-labelledby="login-title">
          <div className="login-form-wrap">
            <div className="login-mobile-brand"><img src="/brand/investoros-logo.png" alt="InvestorOS" /></div>
            <div className="login-security-mark"><ShieldCheck size={17} aria-hidden="true" /><span>ACCÈS ADMINISTRATEUR</span></div>
            <h2 id="login-title">{challengeTitle}</h2>
            <p className="login-intro">
              {step === 'new-password'
                ? 'Pour protéger votre compte, remplacez le mot de passe temporaire par un mot de passe personnel.'
                : step === 'totp-setup'
                  ? 'Scannez le code avec votre application d’authentification, puis saisissez le code à six chiffres.'
                  : step === 'totp'
                    ? 'Saisissez le code à six chiffres affiché dans votre application d’authentification.'
                    : 'Connectez-vous à votre espace avec les identifiants de votre compte administrateur.'}
            </p>
            {step === 'credentials' ? (
              <form className="personal-login-form aws-login-form" onSubmit={(event) => void submitAwsCredentials(event)}>
                <div className="login-field">
                  <label htmlFor="aws-username">Nom d’utilisateur</label>
                  <input id="aws-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
                </div>
                <div className="login-field">
                  <label htmlFor="aws-password">Mot de passe</label>
                  <div className="password-input-wrap">
                    <input id="aws-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" />
                    <button className="password-visibility" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPassword}>
                      {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Vérification…' : 'Se connecter'} <ArrowRight size={16} aria-hidden="true" /></button>
              </form>
            ) : step === 'new-password' ? (
              <form className="personal-login-form aws-login-form" onSubmit={(event) => void submitAwsChallenge(event)}>
                <div className="login-field">
                  <label htmlFor="aws-new-password">Nouveau mot de passe</label>
                  <input id="aws-new-password" type="password" autoComplete="new-password" minLength={14} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="14 caractères ou plus" />
                  <p className="login-field-note">Majuscule, minuscule, chiffre et symbole requis.</p>
                </div>
                <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Mise à jour…' : 'Continuer'} <ArrowRight size={16} aria-hidden="true" /></button>
              </form>
            ) : (
              <form className="personal-login-form aws-login-form" onSubmit={(event) => void submitAwsChallenge(event)}>
                {step === 'totp-setup' && (
                  <div className="totp-setup-card">
                    {totpQr && <img className="totp-setup-qr" src={totpQr} alt="Code QR pour ajouter InvestorOS à votre application d’authentification" />}
                    <p>Scannez ce code avec Google Authenticator, Microsoft Authenticator ou une application compatible.</p>
                    <details><summary>Entrer la clé manuellement</summary><code>{totpSecret}</code></details>
                  </div>
                )}
                <div className="login-field"><label htmlFor="aws-totp">Code de vérification</label><input id="aws-totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" maxLength={8} required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="000 000" /></div>
                <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Vérification…' : step === 'totp-setup' ? 'Activer la vérification' : 'Vérifier et continuer'} <ArrowRight size={16} aria-hidden="true" /></button>
              </form>
            )}
            {message && <p className="login-status" role="alert">{message}</p>}
            {step !== 'credentials' && <button type="button" className="login-challenge-back" onClick={() => void cancelAwsChallenge()} disabled={busy}><ArrowLeft size={14} aria-hidden="true" /> Revenir à la connexion</button>}
            <p className="login-terms">Connexion chiffrée par Amazon Cognito · MFA obligatoire</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-art-panel" aria-label="InvestorOS">
        <MeshDriftBackground />
        <div className="login-art-wash" />
        <button className="login-back" onClick={() => navigate('/')} aria-label="Retour à l’accueil">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <a className="login-brand" href="/" aria-label="InvestorOS, accueil">
          <img src="/brand/investoros-logo.png" alt="InvestorOS" />
        </a>
        <div className="login-art-copy">
          <h1>Votre capital mérite une meilleure boussole.</h1>
          <p>Explorez vos objectifs, mesurez les compromis et comprenez ce qui soutient chaque analyse.</p>
        </div>
        <p className="login-art-foot">Une décision plus claire commence par les bonnes questions.</p>
      </section>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <img src="/brand/investoros-logo.png" alt="InvestorOS" />
          </div>
          <h2 id="login-title">Bienvenue dans InvestorOS</h2>
          <p className="login-intro">Connectez-vous à votre espace d’investissement.</p>

          <form className="personal-login-form" onSubmit={(event) => { event.preventDefault(); explainUnavailableLogin(); }}>
            <div className="login-field">
              <label htmlFor="login-email">Adresse courriel</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nom@exemple.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Mot de passe</label>
              <div className="password-input-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="password-visibility"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="remember-option" htmlFor="remember-me">
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Se souvenir de moi</span>
              </label>
              <button className="forgot-password" type="button" onClick={explainUnavailableLogin}>
                Mot de passe oublié?
              </button>
            </div>

            <button className="login-submit" type="submit">Se connecter</button>
            {message && <p className="login-status" role="status">{message}</p>}
          </form>

          <div className="login-divider"><span>ou</span></div>

          <button className="login-google" type="button" disabled aria-disabled="true">
            <GoogleMark />
            <span>Continuer avec Google</span>
            <span className="provider-status">Indisponible</span>
          </button>

          <div className="demo-access-card">
            <div className="demo-access-copy">
              <h3>Explorer la démonstration</h3>
              <p>Ouvrez l’application avec des profils et portefeuilles fictifs, sans compte.</p>
            </div>
            <button className="demo-access-button" type="button" onClick={() => navigate('/app')}>
              Accéder à la démo <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="login-terms">La connexion personnelle n’est pas encore disponible. Les champs du formulaire restent sur cette page et ne sont transmis nulle part.</p>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
