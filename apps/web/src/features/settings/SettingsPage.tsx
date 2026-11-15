import { ArrowRight, Check, LoaderCircle, QrCode, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../shared/auth';
import './settings-page.css';

export function SettingsPage() {
  const auth = useAuth();
  const [loading, setLoading] = useState(auth.enabled);
  const [busy, setBusy] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setup, setSetup] = useState<{ sharedSecret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!auth.enabled) return;
    let active = true;
    void auth.fetchMFAPreference()
      .then((preference) => {
        if (active) setMfaEnabled(preference.enabled?.includes('TOTP') ?? false);
      })
      .catch(() => {
        if (active) setMessage('Impossible de lire les paramètres de sécurité. Rechargez la page.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.enabled, auth.fetchMFAPreference]);

  const startSetup = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await auth.beginTOTPSetup();
      const qr = await QRCode.toDataURL(result.setupUri, {
        width: 184,
        margin: 1,
        color: { dark: '#172941', light: '#ffffff' },
      });
      setSetup({ sharedSecret: result.sharedSecret, qr });
    } catch {
      setMessage('La configuration de la double vérification a échoué. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const finishSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await auth.confirmTOTPSetup(code.replace(/\s/g, ''));
      setMfaEnabled(true);
      setSetup(null);
      setCode('');
      setMessage('La double vérification est activée.');
    } catch {
      setMessage('Code invalide ou expiré. Vérifiez l’heure de votre appareil et réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const disableMFA = async () => {
    setBusy(true);
    setMessage('');
    try {
      await auth.disableTOTP();
      setMfaEnabled(false);
      setSetup(null);
      setMessage('La double vérification est désactivée.');
    } catch {
      setMessage('Impossible de modifier ce paramètre. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <header className="settings-heading">
        <div className="settings-heading-icon"><ShieldCheck size={21} aria-hidden="true" /></div>
        <div>
          <p>COMPTE ET SÉCURITÉ</p>
          <h1 id="settings-title">Paramètres</h1>
          <span>Gérez les options de sécurité de votre compte InvestorOS.</span>
        </div>
      </header>

      <section className="settings-security-card" aria-labelledby="mfa-title">
        <div className="settings-card-heading">
          <div className="settings-card-icon"><QrCode size={18} aria-hidden="true" /></div>
          <div>
            <h2 id="mfa-title">Double vérification</h2>
            <p>Ajoutez un code temporaire depuis une application d’authentification.</p>
          </div>
          {auth.enabled && !loading && (
            <span className={`settings-status${mfaEnabled ? ' is-enabled' : ''}`}>
              <span />{mfaEnabled ? 'Activée' : 'Désactivée'}
            </span>
          )}
        </div>

        {!auth.enabled ? (
          <div className="settings-card-body">
            <p>Ce réglage de sécurité est disponible sur le compte AWS. Le mode local continue de fonctionner sans connexion.</p>
          </div>
        ) : loading ? (
          <div className="settings-card-body settings-loading"><LoaderCircle size={16} className="settings-spinner" /> Chargement des paramètres…</div>
        ) : setup ? (
          <form className="settings-card-body settings-mfa-setup" onSubmit={(event) => void finishSetup(event)}>
            <div className="settings-setup-instructions">
              <img src={setup.qr} alt="Code QR pour ajouter InvestorOS à votre application d’authentification" />
              <div>
                <h3>Scannez le code QR</h3>
                <p>Utilisez une application compatible, comme Google Authenticator ou Microsoft Authenticator, puis saisissez le code à six chiffres.</p>
                <details><summary>Entrer la clé manuellement</summary><code>{setup.sharedSecret}</code></details>
              </div>
            </div>
            <label className="settings-code-field" htmlFor="settings-totp-code">
              Code de vérification
              <input
                id="settings-totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,8}"
                maxLength={8}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="000 000"
              />
            </label>
            <div className="settings-actions">
              <button type="button" className="settings-secondary-button" onClick={() => { setSetup(null); setCode(''); }} disabled={busy}>Annuler</button>
              <button type="submit" className="settings-primary-button" disabled={busy}>{busy ? 'Vérification…' : 'Activer'} <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
          </form>
        ) : (
          <div className="settings-card-body">
            {mfaEnabled ? (
              <>
                <div className="settings-confirmed"><Check size={15} aria-hidden="true" /><p>Une application d’authentification protège les prochaines connexions à ce compte.</p></div>
                <div className="settings-actions"><button type="button" className="settings-secondary-button" onClick={() => void disableMFA()} disabled={busy}>{busy ? 'Mise à jour…' : 'Désactiver la double vérification'}</button></div>
              </>
            ) : (
              <>
                <p>La double vérification est désactivée pour simplifier l’accès au compte partagé. La connexion reste protégée par le mot de passe. Vous pourrez l’activer ici à tout moment.</p>
                <div className="settings-actions"><button type="button" className="settings-primary-button" onClick={() => void startSetup()} disabled={busy}>{busy ? 'Préparation…' : 'Configurer une application'} <ArrowRight size={15} aria-hidden="true" /></button></div>
              </>
            )}
          </div>
        )}
        {message && <p className="settings-message" role="status">{message}</p>}
      </section>
    </section>
  );
}
