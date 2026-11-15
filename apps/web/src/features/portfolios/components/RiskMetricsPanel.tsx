import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, RotateCw } from 'lucide-react';
import { authenticatedFetch } from '../../../shared/auth';
import type { DemoOverview } from '../../../shared/api';
import { fieldOrder, initialProfiles, type FieldKey, type Profile } from '../../profiles/profile-model';
import { profileApiBase, streamProfile, type ProfileEvent } from '../../profiles/profile-api';

type RiskState = { status: 'loading' | 'ready' | 'error'; text: string; message?: string };
type MemoryPayload = { profile?: Profile | null; tabs?: unknown[] };

export function RiskMetricsPanel({ accountId, accountName, portfolio }: {
  accountId: DemoOverview['persona'];
  accountName: string;
  portfolio: DemoOverview['portfolio'];
}) {
  const [risk, setRisk] = useState<RiskState>({ status: 'loading', text: '' });
  const [reload, setReload] = useState(0);

  const analyze = useCallback(async (signal: AbortSignal) => {
    setRisk({ status: 'loading', text: '' });
    try {
      const response = await authenticatedFetch(`${profileApiBase}/v1/profiles/memory/${accountId}`, { headers: { Accept: 'application/json' }, signal });
      if (!response.ok) throw new Error('Le profil mémorisé est indisponible.');
      const memory = await response.json() as MemoryPayload;
      const profile = memory.profile ?? initialProfiles[accountId];
      const profileFacts = Object.fromEntries(fieldOrder.map((key) => [key, profile[key]])) as Record<FieldKey, string>;
      const body = {
        accountId,
        workspaceMode: 'profiles',
        profile: profileFacts,
        tabs: Array.isArray(memory.tabs) ? memory.tabs : [],
        history: [],
        message: `Analyse les risques précis du portefeuille fictif de ${accountName} et sa pertinence au regard de son profil, de ses objectifs, de son horizon, de sa tolérance au risque, de sa capacité à absorber une perte et de ses besoins de liquidité. Utilise analyze_demo_portfolio avant toute conclusion. Réponds en français en 3 ou 4 puces maximum : pour chaque risque, indique l'exposition ou le poids réellement retourné, le lien explicite avec le profil, puis ce qui reste inconnu. Termine par les limites. Ne fabrique aucun risque chiffré, aucune donnée de marché ou titre sous-jacent, ne recommande ni achat, ni vente, ni réallocation, et ne modifie pas le profil. Si les données ne soutiennent pas plusieurs risques précis, dis-le clairement.`,
      };
      let text = '';
      await streamProfile(body, signal, (event: ProfileEvent) => {
        if (event.type === 'text' && typeof event.delta === 'string') text += event.delta;
        if (event.type === 'error') throw new Error(typeof event.message === 'string' ? event.message : 'L’analyse IA n’a pas abouti.');
        if (text) setRisk({ status: 'loading', text });
      });
      if (!signal.aborted) {
        if (!text.trim()) throw new Error('L’assistant n’a pas fourni de risques analysables.');
        setRisk({ status: 'ready', text: text.trim() });
      }
    } catch (error) {
      if (!signal.aborted) setRisk({ status: 'error', text: '', message: error instanceof Error ? error.message : 'Analyse IA indisponible.' });
    }
  }, [accountId, accountName]);

  useEffect(() => {
    const controller = new AbortController();
    void analyze(controller.signal);
    return () => controller.abort();
  }, [analyze, reload, portfolio.total_value]);

  return (
    <section className="portfolio-panel portfolio-risk-panel" aria-labelledby="risk-heading" aria-busy={risk.status === 'loading'}>
      <header className="portfolio-panel-heading">
        <div><span className="portfolio-section-icon is-risk"><AlertTriangle size={16} /></span><div><h2 id="risk-heading">Risques liés à votre profil</h2><p><Bot size={12} /> Analyse IA · profil mémorisé et positions du compte fictif</p></div></div>
        <button type="button" className="portfolio-refresh-button" onClick={() => setReload((value) => value + 1)} disabled={risk.status === 'loading'} aria-label="Régénérer l’analyse des risques" title="Régénérer l’analyse"><RotateCw size={15} /></button>
      </header>
      {risk.status === 'loading' && !risk.text && <div className="portfolio-risk-state"><span className="portfolio-risk-spinner" />Analyse des positions selon le profil de {accountName}…</div>}
      {risk.status === 'error' && <div className="portfolio-risk-state is-error" role="alert"><AlertTriangle size={16} /><span>{risk.message}</span><button type="button" onClick={() => setReload((value) => value + 1)}>Réessayer</button></div>}
      {risk.text && <div className={`portfolio-risk-answer${risk.status === 'loading' ? ' is-streaming' : ''}`} aria-live="polite">{risk.text}</div>}
      <footer className="portfolio-panel-footnote">Lecture qualitative des déclarations et pondérations disponibles. Aucune série historique ni sous-jacent détaillé n’est fourni par cette fixture; ce résultat n’est pas un conseil financier.</footer>
    </section>
  );
}
