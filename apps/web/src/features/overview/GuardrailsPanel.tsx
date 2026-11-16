import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleHelp, FlaskConical, LockKeyhole, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

type Guardrail = {
  guardrailId: string; name: string; description: string; version: string; status: string;
  managed: boolean; updatedAt?: string | null;
};
type Binding = { enabled: boolean; guardrailId: string | null; guardrailVersion: string | null };
type GuardrailIndex = { readAt: string; region: string; available: boolean; configurable: boolean; guardrails: Guardrail[]; active: Binding };
type GuardrailDetail = {
  guardrailId: string; name: string; description: string; status: string; version: string;
  versions: Array<{ version: string; status: string; description: string }>;
  policies: Record<string, unknown>; blockedInputMessaging: string; blockedOutputsMessaging: string;
};
type ContentFilter = { type?: string; inputStrength?: string; outputStrength?: string; inputEnabled?: boolean; outputEnabled?: boolean };
type PiiFilter = { type?: string; action?: string; inputAction?: string; outputAction?: string; inputEnabled?: boolean; outputEnabled?: boolean };
type TestResult = { action: string; blocked: boolean; output: string; filtersTriggered: string[]; source: 'INPUT' | 'OUTPUT' };
type AdminRequest = <T,>(path: string, signal?: AbortSignal, init?: RequestInit) => Promise<T>;

const filterLabels: Record<string, string> = {
  contentPolicy: 'Contenu nuisible', topicPolicy: 'Sujets interdits', wordPolicy: 'Mots filtrés',
  sensitiveInformationPolicy: 'Données sensibles', contextualGroundingPolicy: 'Ancrage contextuel',
  automatedReasoningPolicy: 'Raisonnement automatisé',
};

export function GuardrailsPanel({ request }: { request: AdminRequest }) {
  const [index, setIndex] = useState<GuardrailIndex | null>(null);
  const [detail, setDetail] = useState<GuardrailDetail | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [source, setSource] = useState<'INPUT' | 'OUTPUT'>('INPUT');
  const [text, setText] = useState('Compare les risques de concentration de ce portefeuille fictif sans recommander de transaction.');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const managed = useMemo(() => index?.guardrails.find(item => item.guardrailId === selectedId) ?? null, [index, selectedId]);
  const publishedVersions = useMemo(() => (detail?.versions ?? []).filter(item => /^\d+$/.test(item.version)), [detail]);

  const inspect = useCallback(async (guardrailId: string, signal?: AbortSignal, activeBinding?: Binding) => {
    setSelectedId(guardrailId);
    setDetail(null);
    setTestResult(null);
    try {
      const result = await request<GuardrailDetail>(`guardrails/${encodeURIComponent(guardrailId)}`, signal);
      setDetail(result);
      setSelectedVersion(activeBinding?.guardrailId === guardrailId
        ? activeBinding.guardrailVersion ?? result.version
        : result.versions.find(version => /^\d+$/.test(version.version))?.version ?? result.version);
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'Le détail du garde-fou est indisponible.');
    }
  }, [request]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await request<GuardrailIndex>('guardrails', signal);
      setIndex(result);
      const chosen = result.guardrails.find(item => item.guardrailId === result.active.guardrailId)?.guardrailId
        ?? result.guardrails.find(item => item.managed)?.guardrailId
        ?? '';
      if (chosen) await inspect(chosen, signal, result.active);
      else { setSelectedId(''); setDetail(null); }
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'Les garde-fous Bedrock sont indisponibles.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [inspect, request]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const setActive = async (enabled: boolean) => {
    if (!managed || !selectedVersion || !/^\d+$/.test(selectedVersion)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await request<Binding>('guardrails/config', undefined, {
        method: 'PUT', body: JSON.stringify({ enabled, guardrailId: managed.guardrailId, guardrailVersion: selectedVersion }),
      });
      setIndex(current => current ? { ...current, active: result } : current);
      setMessage(enabled ? `Version ${selectedVersion} activée pour les nouvelles conversations.` : 'Les garde-fous sont désactivés pour les nouvelles conversations.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'La configuration n’a pas été enregistrée.'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await request<Binding>('guardrails/config', undefined, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
      setIndex(current => current ? { ...current, active: result } : current);
      setMessage('Les garde-fous sont désactivés pour les nouvelles conversations.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'La configuration n’a pas été enregistrée.'); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!managed) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await request<{ version: string }>(`guardrails/${encodeURIComponent(managed.guardrailId)}/versions`, undefined, {
        method: 'POST', body: JSON.stringify({ description: 'Version publiée depuis la console Admin InvestorOS' }),
      });
      setSelectedVersion(result.version);
      setMessage(`Publication de la version ${result.version} démarrée. Actualisez dans quelques secondes pour la tester puis l’activer.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'La version n’a pas pu être publiée.'); }
    finally { setBusy(false); }
  };

  const runTest = async () => {
    if (!managed || !text.trim()) return;
    setBusy(true); setError(''); setMessage(''); setTestResult(null);
    try {
      const result = await request<TestResult>('guardrails/test', undefined, {
        method: 'POST', body: JSON.stringify({ guardrailId: managed.guardrailId, guardrailVersion: selectedVersion, source, text }),
      });
      setTestResult(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Le test du garde-fou a échoué.'); }
    finally { setBusy(false); }
  };

  const active = Boolean(index?.active.enabled && index.active.guardrailId === selectedId && index.active.guardrailVersion === selectedVersion);
  const contentFilters = (detail?.policies.contentPolicy as { filtersConfig?: ContentFilter[] } | undefined)?.filtersConfig ?? [];
  const piiFilters = (detail?.policies.sensitiveInformationPolicy as { piiEntitiesConfig?: PiiFilter[] } | undefined)?.piiEntitiesConfig ?? [];
  const customFilterCount = Object.keys(detail?.policies ?? {}).filter(key => !['contentPolicy', 'sensitiveInformationPolicy'].includes(key)).length;

  return <div className="admin-content-panel guardrails-panel">
    <div className="admin-section-heading">
      <div><h2>Garde-fous Amazon Bedrock</h2><p>Inspecter les règles, tester INPUT/OUTPUT et choisir une version publiée pour les prochaines conversations.</p></div>
      <button className="guardrail-secondary" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={14} className={loading ? 'is-spinning' : ''} />Actualiser</button>
    </div>
    {error && <div className="guardrail-alert is-error"><AlertTriangle size={15} />{error}</div>}
    {message && <div className="guardrail-alert is-success"><Check size={15} />{message}</div>}
    {loading ? <div className="arch-loading"><RefreshCw className="is-spinning" size={18} />Lecture des garde-fous AWS…</div> : <>
      {!index?.configurable && <div className="guardrail-alert"><CircleHelp size={15} />Le panneau est prêt, mais son paramètre SSM n’est pas configuré dans cet environnement. Déployez le stack assistant-simulation pour activer la gestion.</div>}
      {index?.guardrails.length === 0 && <div className="admin-card guardrail-empty"><ShieldAlert size={22} /><div><strong>Aucun garde-fou Bedrock présent dans {index.region}.</strong><span>Le stack Terraform déclare un garde-fou de base et sa version publiée initiale; ils apparaîtront ici après déploiement.</span></div></div>}
      {!!index?.guardrails.length && <div className="guardrails-layout">
        <section className="admin-card guardrail-list-card" aria-label="Garde-fous disponibles">
          <div className="admin-card-heading"><div><h3>Garde-fous détectés</h3><p>{index.region} · lecture Bedrock en direct</p></div><span className="admin-count-pill">{index.guardrails.length}</span></div>
          <div className="guardrail-list">{index.guardrails.map(item => <button key={item.guardrailId} className={`guardrail-choice ${item.guardrailId === selectedId ? 'is-selected' : ''}`} onClick={() => void inspect(item.guardrailId, undefined, index.active)} disabled={!item.managed}>
            <span className="guardrail-choice-icon"><ShieldCheck size={16} /></span><span className="guardrail-choice-copy"><strong>{item.name}</strong><small>{item.status} · {item.managed ? 'géré par InvestorOS' : 'lecture seule'}</small></span>
            {index.active.enabled && index.active.guardrailId === item.guardrailId && <i className="guardrail-active-dot" title="Actif" />}
          </button>)}</div>
        </section>
        <section className="admin-card guardrail-detail-card" aria-label="Configuration du garde-fou sélectionné">
          {!detail ? <div className="admin-empty">Sélectionnez un garde-fou géré par InvestorOS.</div> : <>
            <div className="admin-card-heading"><div><h3>{detail.name}</h3><p>{detail.description || 'Aucune description AWS.'}</p></div><span className={`guardrail-status ${detail.status === 'READY' ? 'is-ready' : ''}`}>{detail.status}</span></div>
            <div className="guardrail-active-row"><span>Protection des conversations</span><strong className={active ? 'security-good' : 'security-warn'}>{active ? `Active · version ${selectedVersion}` : 'Inactive'}</strong></div>
            <label className="guardrail-field">Version
              <select value={selectedVersion} onChange={event => setSelectedVersion(event.target.value)}>
                {detail.version === 'DRAFT' && <option value="DRAFT">DRAFT · test uniquement</option>}
                {publishedVersions.map(item => <option key={item.version} value={item.version}>v{item.version} · {item.status}</option>)}
              </select>
            </label>
            <div className="guardrail-actions">
              <button className="guardrail-primary" onClick={() => void setActive(true)} disabled={!managed?.managed || !index?.configurable || busy || !/^\d+$/.test(selectedVersion)}><ShieldCheck size={14} />Activer cette version</button>
              <button className="guardrail-secondary" onClick={() => void disable()} disabled={!index?.active.enabled || !index?.configurable || busy}>Désactiver</button>
              {detail.version === 'DRAFT' && <button className="guardrail-secondary" onClick={() => void publish()} disabled={!managed?.managed || busy}>Publier le brouillon</button>}
            </div>
            <div className="guardrail-policy-list"><strong>Filtres configurés</strong>
              {contentFilters.map((filter, index) => <span key={`content-${filter.type}-${index}`}><Check size={12} />{filter.type ?? 'Contenu'} · entrée {filter.inputEnabled === false ? 'off' : filter.inputStrength ?? '—'} · sortie {filter.outputEnabled === false ? 'off' : filter.outputStrength ?? '—'}</span>)}
              {piiFilters.map((filter, index) => <span key={`pii-${filter.type}-${index}`}><Check size={12} />{filter.type ?? 'Donnée sensible'} · entrée {filter.inputEnabled === false ? 'off' : filter.inputAction ?? filter.action ?? '—'} · sortie {filter.outputEnabled === false ? 'off' : filter.outputAction ?? filter.action ?? '—'}</span>)}
              {customFilterCount > 0 && <span><Check size={12} />{customFilterCount} autre(s) catégorie(s) de règle</span>}
              {!contentFilters.length && !piiFilters.length && customFilterCount === 0 && <small>Aucun filtre détaillé retourné.</small>}
            </div>
            <p className="guardrail-version-note"><LockKeyhole size={13} />La conversation utilise une version numérique publiée. Les changements de règle se font dans Terraform/Bedrock, puis se testent sur DRAFT avant publication.</p>
          </>}
        </section>
        {detail && <section className="admin-card guardrail-test-card" aria-label="Tester le garde-fou">
          <div className="admin-card-heading"><div><h3>Tester un texte</h3><p>Évaluation directe avec ApplyGuardrail; aucune invocation du modèle.</p></div><span className="admin-kpi-icon teal"><FlaskConical size={16} /></span></div>
          <div className="guardrail-test-controls"><label>Évaluer comme<select value={source} onChange={event => setSource(event.target.value as 'INPUT' | 'OUTPUT')}><option value="INPUT">Entrée utilisateur</option><option value="OUTPUT">Réponse IA</option></select></label><span>Version {selectedVersion}</span></div>
          <textarea value={text} onChange={event => setText(event.target.value)} maxLength={6000} aria-label="Texte à évaluer" />
          <div className="guardrail-test-footer"><small>{text.length}/6 000 caractères · non conservé par InvestorOS</small><button className="guardrail-primary" onClick={() => void runTest()} disabled={!managed?.managed || busy || !text.trim()}><FlaskConical size={14} />{busy ? 'Évaluation…' : 'Lancer le test'}</button></div>
          {testResult && <div className={`guardrail-test-result ${testResult.blocked ? 'is-blocked' : 'is-passed'}`}><strong>{testResult.blocked ? 'Intervention du garde-fou' : 'Texte accepté'}</strong><span>Action : {testResult.action} · {testResult.source}</span>{testResult.filtersTriggered.length > 0 && <span>Filtres : {testResult.filtersTriggered.map(key => filterLabels[key] ?? key).join(', ')}</span>}<p>{testResult.output}</p></div>}
        </section>}
      </div>}
      <div className="admin-security-note"><ShieldAlert size={15} /><span>Le profil de base anonymise courriels, téléphones, adresses, NAS, cartes et secrets détectés; il filtre les contenus malveillants et les attaques de prompt. Le flux est synchrone et sans trace afin de ne pas diffuser un segment avant son évaluation. Les validations métier déterministes et l’interdiction des conseils personnalisés restent actives séparément. Bedrock facture ses évaluations de Guardrails selon le volume évalué.</span></div>
    </>}
  </div>;
}
