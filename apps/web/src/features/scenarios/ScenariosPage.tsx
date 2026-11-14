import { useEffect, useState } from 'react';
import { ArrowRight, Calculator, CircleAlert, Database, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { calculateDemoScenario, loadDemoOverview, type DemoApiConnection, type PortfolioScenarioImpact } from '../../shared/api';
import './scenarios.css';

export function ScenariosPage() {
  const { activeAccount } = useDemoAccount();
  const [connection, setConnection] = useState<DemoApiConnection | { status: 'loading' }>({ status: 'loading' });
  const [name, setName] = useState('Choc conditionnel');
  const [shocks, setShocks] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PortfolioScenarioImpact>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setConnection({ status: 'loading' });
    setShocks({});
    setResult(undefined);
    setError('');
    loadDemoOverview(activeAccount.id, controller.signal)
      .then((data) => {
        setConnection(data);
        if (data.status === 'connected') {
          setShocks(Object.fromEntries(data.overview.portfolio.positions.map((position) => [position.id, '0'])));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeAccount.id]);

  async function runScenario() {
    if (connection.status !== 'connected') return;
    const selected = Object.entries(shocks)
      .filter(([, value]) => value.trim() !== '' && Number(value) !== 0)
      .map(([positionId, value]) => ({ positionId, shockPct: Number(value) }));
    if (!selected.length) {
      setError('Ajoutez au moins une variation explicite différente de 0 %.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      setResult(await calculateDemoScenario(activeAccount.id, { name: name.trim() || 'Scénario', shocks: selected }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le calcul conditionnel a échoué.');
    } finally {
      setBusy(false);
    }
  }

  const formatter = connection.status === 'connected'
    ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: connection.overview.portfolio.currency, maximumFractionDigits: 0 })
    : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

  return (
    <section className="scenarios-page" aria-labelledby="scenarios-title">
      <header className="scenarios-header">
        <div><span className="scenarios-eyebrow"><Calculator size={14} /> ANALYSE CONDITIONNELLE</span><h1 id="scenarios-title">Scénarios de portefeuille</h1><p>Modifiez des hypothèses de variation et observez leur effet arithmétique sur le portefeuille fictif actif.</p></div>
        <span className="scenarios-demo-badge"><Database size={14} /> Données de démonstration</span>
      </header>

      {connection.status === 'loading' ? (
        <div className="scenarios-state" role="status"><LoaderCircle size={17} className="scenarios-spinner" />Lecture du portefeuille {activeAccount.name}…</div>
      ) : connection.status !== 'connected' ? (
        <div className="scenarios-state is-error" role="status"><CircleAlert size={17} />Le portefeuille AWS est indisponible. Vérifiez la connexion de l’API de démonstration.</div>
      ) : (
        <>
          <div className="scenarios-source-note"><ShieldCheck size={16} /><span><strong>{connection.overview.portfolio.display_name}</strong> · {formatter.format(connection.overview.portfolio.total_value)} · {connection.overview.portfolio.positions.length} positions · lecture AWS en lecture seule</span><Link to="/app/portfolios">Voir le portefeuille <ArrowRight size={13} /></Link></div>

          <div className="scenarios-workspace">
            <section className="scenario-assumptions" aria-labelledby="assumptions-title">
              <div className="scenario-section-heading"><span className="scenario-step-number">01</span><div><h2 id="assumptions-title">Vos hypothèses</h2><p>Choisissez une variation pour chaque position. Les autres restent inchangées.</p></div></div>
              <label className="scenario-name-field">Nom du scénario<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
              <div className="scenario-position-list">
                {connection.overview.portfolio.positions.map((position) => (
                  <label className="scenario-position-row" key={position.id}>
                    <span className="scenario-position-main"><strong>{position.label}</strong><small>{position.weight_pct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} % · {formatter.format(position.value)}</small></span>
                    <span className="scenario-shock-control"><input aria-label={`Variation hypothétique pour ${position.label}`} type="number" min="-100" max="200" step="5" value={shocks[position.id] ?? '0'} onChange={(event) => setShocks((current) => ({ ...current, [position.id]: event.target.value }))} /><span>%</span></span>
                  </label>
                ))}
              </div>
              <p className="scenario-input-help">Bornes permises : −100 % à +200 %. Ces variations sont des hypothèses choisies par vous, pas des rendements prévus.</p>
              {error && <p className="scenario-error" role="alert"><CircleAlert size={14} />{error}</p>}
              <button className="scenario-run-button" type="button" onClick={runScenario} disabled={busy}>
                {busy ? <LoaderCircle size={15} className="scenarios-spinner" /> : <Calculator size={15} />}
                {busy ? 'Calcul en cours…' : 'Calculer le scénario'}
              </button>
            </section>

            <section className="scenario-result" aria-labelledby="scenario-result-title" aria-live="polite">
              {result ? (
                <>
                  <div className="scenario-section-heading"><span className="scenario-step-number">02</span><div><h2 id="scenario-result-title">{result.name}</h2><p>Résultat calculé à partir des montants de la fixture</p></div></div>
                  <dl className="scenario-summary-metrics">
                    <div><dt>Valeur de départ</dt><dd>{formatter.format(result.baselineValue)}</dd></div>
                    <div><dt>Variation totale</dt><dd className={result.changeValue < 0 ? 'is-negative' : 'is-positive'}>{result.changeValue > 0 ? '+' : ''}{formatter.format(result.changeValue)} <small>({result.changePct > 0 ? '+' : ''}{result.changePct.toLocaleString('fr-CA')} %)</small></dd></div>
                    <div><dt>Valeur selon vos hypothèses</dt><dd>{formatter.format(result.scenarioValue)}</dd></div>
                  </dl>
                  <div className="scenario-result-table-wrap"><table className="scenario-result-table"><thead><tr><th>Position</th><th>Hypothèse</th><th>Impact</th><th>Après</th></tr></thead><tbody>{result.positions.filter((position) => position.shockPct !== 0).map((position) => <tr key={position.positionId}><th scope="row">{position.label}</th><td>{position.shockPct > 0 ? '+' : ''}{position.shockPct.toLocaleString('fr-CA')} %</td><td className={position.changeValue < 0 ? 'is-negative' : 'is-positive'}>{position.changeValue > 0 ? '+' : ''}{formatter.format(position.changeValue)}</td><td>{formatter.format(position.scenarioValue)}</td></tr>)}</tbody></table></div>
                  <Link className="scenario-assistant-link" to="/app/assistant" state={{ initialPrompt: `Explique le scénario conditionnel « ${result.name} » pour ${connection.overview.account.display_name}. Les hypothèses choisies sont : ${result.positions.filter((position) => position.shockPct !== 0).map((position) => `${position.label} ${position.shockPct > 0 ? '+' : ''}${position.shockPct}%`).join('; ')}. Utilise le résultat calculé, précise que ce n’est pas une prévision et indique les limites.` }}>Demander une explication à l’Assistant <ArrowRight size={14} /></Link>
                  <ul className="scenario-limitations">{result.provenance.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
                </>
              ) : (
                <div className="scenario-empty"><Calculator size={23} /><h2 id="scenario-result-title">Le résultat apparaîtra ici</h2><p>Le calcul applique vos variations aux valeurs de la fixture. Il ne modélise pas les trajectoires de marché ni les relations entre positions.</p></div>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
