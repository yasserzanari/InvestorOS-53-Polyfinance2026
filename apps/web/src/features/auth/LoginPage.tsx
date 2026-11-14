import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MeshDriftBackground } from './MeshDriftBackground';
import './login-page.css';

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState('');

  const explainUnavailableLogin = () => {
    setMessage('La connexion à un compte personnel sera bientôt disponible. Vos champs ne sont pas envoyés.');
  };

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
