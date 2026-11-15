import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, CircleHelp,
  Clock3, GraduationCap, Info, Landmark, Leaf, LockKeyhole, Pencil, ShieldCheck,
  SlidersHorizontal, Sparkles, Target, WalletCards,
} from 'lucide-react';
import { fieldLabels, fieldOrder, type FieldKey, type Profile } from './profile-model';
import { isProfileFieldMissing } from './profile-consistency';
import { goalsFromTab, type DemoGoal, type DemoSituation } from './profile-demo-data';
import type { WorkspaceTab } from './profile-api';
import './profile-detail-tabs.css';

export type ProfileDetailTabId = 'overview' | 'objectives' | 'situation' | 'risk' | 'preferences' | 'memory';
const sectionTabs: { id: ProfileDetailTabId; label: string; icon: typeof Target }[] = [
  { id: 'overview', label: 'Aperçu', icon: Landmark },
  { id: 'objectives', label: 'Objectifs', icon: Target },
  { id: 'situation', label: 'Situation', icon: BriefcaseBusiness },
  { id: 'risk', label: 'Risque', icon: Activity },
  { id: 'preferences', label: 'Préférences', icon: SlidersHorizontal },
  { id: 'memory', label: 'Mémoire', icon: WalletCards },
];

function completion(profile: Profile) {
  return fieldOrder.filter(key => !isProfileFieldMissing(profile[key])).length;
}

function ProfileField({ field, profile, onChange, compact = false }: {
  field: FieldKey; profile: Profile; onChange: (key: FieldKey, value: string) => void; compact?: boolean;
}) {
  const missing = isProfileFieldMissing(profile[field]);
  return <label className={`pdt-field${missing ? ' is-missing' : ''}${compact ? ' is-compact' : ''}`}>
    <span className="pdt-field-label">{fieldLabels[field]}{missing ? <small>À préciser</small> : <Check size={15}/>}</span>
    <textarea aria-label={fieldLabels[field]} value={profile[field]} onChange={event => onChange(field, event.currentTarget.value)} rows={compact ? 2 : 3}/>
    <span className="pdt-field-origin">{profile.origins[field] || 'Déclaration de la personne'}</span>
  </label>;
}

function Timeline({ goals }: { goals: DemoGoal[] }) {
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const markers = (goal: DemoGoal) => [
    { year, label: 'Départ', type: 'start' },
    { year: year + Math.max(1, Math.round(goal.horizonYears * .25)), label: 'Revue', type: 'review' },
    { year: year + Math.max(2, Math.round(goal.horizonYears * .6)), label: 'Point d’étape', type: 'review' },
    { year: year + goal.horizonYears, label: 'Horizon indicatif', type: 'target' },
  ].filter((item, index, all) => all.findIndex(other => other.year === item.year) === index);

  return <section className="pdt-timeline" aria-labelledby="pdt-timeline-title">
    <header className="pdt-section-heading"><div><span className="pdt-icon-tile"><CalendarDays size={19}/></span><div><h3 id="pdt-timeline-title">Chronologie des projets</h3><p>Repères proposés, à confirmer par la personne.</p></div></div><span className="pdt-demo-badge">Jalons de démonstration</span></header>
    <div className="pdt-timeline-lanes">{goals.map(goal => <div className="pdt-timeline-lane" key={goal.id}>
      <div className="pdt-lane-title"><strong>{goal.title}</strong><span>{goal.role} · {goal.horizonYears} ans</span></div>
      <div className="pdt-track" role="img" aria-label={`Chronologie fictive pour ${goal.title}, de ${year} à ${year + goal.horizonYears}`}>
        <div className="pdt-track-line"/>
        {markers(goal).map((marker, index, list) => {
          const position = list.length === 1 ? 0 : index / (list.length - 1) * 100;
          return <div className={`pdt-marker is-${marker.type}`} key={`${marker.year}-${marker.label}`} style={{ left: `${position}%` }}>
            <span className="pdt-marker-dot"/><span className="pdt-marker-date">{marker.year}</span><span className="pdt-marker-label">{marker.label}</span>
          </div>;
        })}
      </div>
    </div>)}</div>
    <p className="pdt-footnote"><Info size={14}/>Les jalons intermédiaires sont des exemples d’organisation, pas des échéances déclarées ni des rendements prévus.</p>
  </section>;
}

function SituationPanel({ situation }: { situation: DemoSituation }) {
  const rows = [
    { label: 'Revenu et stabilité', value: situation.incomeRange, icon: BriefcaseBusiness },
    { label: 'Réserve de liquidités', value: situation.liquidities, icon: WalletCards },
    { label: 'Actifs financiers', value: situation.financialAssets, icon: Landmark },
    { label: 'Dettes et levier', value: situation.obligations, icon: Activity },
    { label: 'Contexte personnel pertinent', value: situation.personalContext, icon: Info },
  ];
  return <>
    <section className="pdt-optional-banner"><span className="pdt-icon-tile"><LockKeyhole size={19}/></span><div><strong>Facultatif — vous pouvez passer cette section</strong><p>Dans cette démonstration, aucun renseignement financier n’est nécessaire pour parcourir le profil. Les valeurs visibles sont fictives.</p></div><span className="pdt-optional-pill">Non obligatoire ici</span></section>
    <section className="pdt-panel"><header className="pdt-section-heading"><div><span className="pdt-icon-tile"><BriefcaseBusiness size={19}/></span><div><h3>Situation financière et personnelle</h3><p>Exemples synthétiques, sans données réelles de client.</p></div></div><span className="pdt-demo-badge">Persona fictive</span></header>
      <div className="pdt-situation-grid">{rows.map(({ label, value, icon: Icon }) => <article className="pdt-situation-card" key={label}><span className="pdt-small-icon"><Icon size={17}/></span><div><strong>{label}</strong><p>{value}</p></div><span className="pdt-optional-label">Facultatif</span></article>)}</div>
      <p className="pdt-legal-note">Pour une activité réglementée, les renseignements à recueillir dépendent du service offert et des obligations applicables. Cette maquette n’établit pas de convenance et ne constitue pas un avis juridique.</p>
    </section>
  </>;
}

export function ProfileDetailTabs({ accountId, profile, onChange, onConfirm, onDiscuss, busy, tabs, onTab, requestedView }: {
  accountId: string; profile: Profile; onChange: (key: FieldKey, value: string) => void; onConfirm: () => void; onDiscuss: (prompt: string) => void; busy: boolean;
  tabs: WorkspaceTab[]; onTab: (tab: WorkspaceTab) => void; requestedView?: string;
}) {
  const [view, setView] = useState<ProfileDetailTabId>('overview');
  const total = completion(profile);
  const goalTab = tabs.find(tab => tab.id === 'profile-objectives');
  const storedGoals = goalsFromTab(goalTab, accountId);
  const horizonMatch = profile.horizon.match(/\d+/);
  const declaredHorizon = horizonMatch ? Number(horizonMatch[0]) : undefined;
  const goals = storedGoals.map((goal, index) => index === 0 && declaredHorizon ? { ...goal, horizonYears: declaredHorizon } : goal);
  const canEditGoals = Boolean(goalTab) || tabs.length < 12;
  const situation = (profile.situation ?? {}) as DemoSituation;
  const missing = fieldOrder.filter(key => isProfileFieldMissing(profile[key]));
  const profileName = accountId === 'mateo' ? 'Mateo' : accountId === 'amira' ? 'Amira' : 'Robert';
  const handledRequest = useRef('');
  useEffect(() => {
    if (!requestedView || handledRequest.current === requestedView) return;
    const requested = requestedView.split(':')[0];
    const aliases: Record<string, ProfileDetailTabId> = { profile: 'overview', overview: 'overview', objectives: 'objectives', situation: 'situation', risk: 'risk', preferences: 'preferences', alignment: 'risk', comparison: 'objectives', scenarios: 'objectives', evidence: 'memory', memory: 'memory' };
    const next = aliases[requested];
    if (!next) return;
    setView(next);
    handledRequest.current = requestedView;
  }, [requestedView]);
  const updateGoal = (goal: DemoGoal, field: 'title' | 'description', value: string) => {
    if (!canEditGoals) return;
    const next = goals.map(item => item.id === goal.id ? { ...item, [field]: value } : item);
    onTab({ ...(goalTab ?? { id: 'profile-objectives', title: 'Objectifs du profil', kind: 'profile' as const, content: '' }), content: JSON.stringify({ schema: 1, persona: accountId, goals: next }) });
  };

  return <div className="pdt-root" data-profile-detail-tab={view}>
    <nav className="pdt-tabs" role="tablist" aria-label="Sections du profil investisseur">
      {sectionTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`pdt-tab-${id}`} aria-controls="pdt-panel" aria-selected={view === id} onClick={() => setView(id)}><Icon size={18}/><span>{label}</span>{id === 'situation' && <i aria-label="Facultatif"/>}</button>)}
    </nav>
    <div className="pdt-content" id="pdt-panel" role="tabpanel" aria-labelledby={`pdt-tab-${view}`} aria-busy={busy}>
      {view === 'overview' && <>
        <section className="pdt-hero"><div className="pdt-hero-main"><span className="pdt-icon-tile pdt-large"><Landmark size={22}/></span><div><p className="pdt-eyebrow">PERSONA DE DÉMONSTRATION · DONNÉES FICTIVES</p><h2>Profil investisseur — {profileName}</h2><p>Les réponses restent modifiables; les renseignements inconnus ne sont pas déduits.</p></div><button type="button" className="pdt-button" disabled={busy} onClick={() => onDiscuss('Aide-moi à revoir mon profil investisseur. Ne déduis aucune information inconnue et demande confirmation avant d’enregistrer une nouvelle déclaration.')}><Pencil size={15}/>Modifier avec l’assistant</button></div>
          <div className="pdt-completion"><div className="pdt-progress-ring" style={{ '--pdt-progress': `${total / fieldOrder.length * 100}%` } as React.CSSProperties}><strong>{total}<small>/{fieldOrder.length}</small></strong></div><div><strong>{total === fieldOrder.length ? 'Votre contexte est renseigné' : 'Profil en construction'}</strong><p>{missing.length ? `${missing.length} élément${missing.length > 1 ? 's' : ''} à préciser` : 'Les éléments connus sont renseignés'}</p><button type="button" className="pdt-confirm-button" disabled={busy||profile.confirmed} onClick={onConfirm}>{profile.confirmed ? <><BadgeCheck size={13}/>Confirmé par vous</> : <><Check size={13}/>Confirmer mes réponses</>}</button></div><div className="pdt-status-chips">{sectionTabs.map(({ id, label, icon: Icon }) => <span key={id} className={id === 'situation' ? 'is-optional' : ''}><Icon size={13}/>{label}{id === 'situation' ? ' · facultatif' : ''}</span>)}</div></div>
        </section>
        <div className="pdt-overview-grid">
          <section className="pdt-panel"><header className="pdt-section-heading"><div><span className="pdt-icon-tile"><Target size={19}/></span><div><h3>Objectifs et horizon</h3><p>Ce que la personne souhaite accomplir.</p></div></div><button type="button" className="pdt-link-button" onClick={() => setView('objectives')}>Voir les objectifs<ArrowRight size={14}/></button></header><p className="pdt-summary-copy">{profile.objective}</p><div className="pdt-inline-facts"><span><Clock3 size={15}/><strong>Horizon</strong>{profile.horizon}</span><span><Target size={15}/><strong>Projets</strong>{goals.length} exemples</span></div></section>
          <section className="pdt-panel"><header className="pdt-section-heading"><div><span className="pdt-icon-tile"><Activity size={19}/></span><div><h3>Repères de risque</h3><p>Deux notions distinctes.</p></div></div><button type="button" className="pdt-link-button" onClick={() => setView('risk')}>Voir le détail<ArrowRight size={14}/></button></header><div className="pdt-fact-row"><span>Tolérance aux fluctuations</span><strong>{profile.riskTolerance}</strong></div><div className="pdt-fact-row"><span>Capacité de perte</span><strong>{profile.lossCapacity}</strong></div></section>
          <section className="pdt-panel"><header className="pdt-section-heading"><div><span className="pdt-icon-tile"><Leaf size={19}/></span><div><h3>Préférences déclarées</h3><p>Ne sont pas des critères vérifiés.</p></div></div><button type="button" className="pdt-link-button" onClick={() => setView('preferences')}>Voir le détail<ArrowRight size={14}/></button></header><p className="pdt-summary-copy">{profile.preferences}</p><div className="pdt-inline-facts"><span><GraduationCap size={15}/><strong>Connaissances</strong>{profile.knowledge}</span></div></section>
        </div>
        <section className="pdt-missing"><span className="pdt-small-icon"><CircleHelp size={17}/></span><div><strong>À préciser avec la personne</strong><p>{missing.length ? missing.map(key => fieldLabels[key]).join(' · ') : 'Aucune rubrique obligatoire à compléter.'}</p></div><span className="pdt-optional-pill">Aucune pression à compléter</span></section>
      </>}

      {view === 'objectives' && <>
        <header className="pdt-page-title"><div><span className="pdt-icon-tile pdt-large"><Target size={22}/></span><div><h2>Objectifs et échéances</h2><p>Chaque projet a son propre horizon; les jalons d’exemple peuvent être adaptés.</p></div></div><button type="button" className="pdt-button" disabled={busy} onClick={() => onDiscuss('Aide-moi à préciser un objectif d’investissement distinct. Demande le but, la priorité, l’horizon, le montant cible et l’échéance si la personne les connaît; n’invente aucune réponse.')}><Sparkles size={15}/>Ajouter un objectif</button></header>
        <div className="pdt-objective-fields"><ProfileField field="objective" profile={profile} onChange={onChange}/><ProfileField field="horizon" profile={profile} onChange={onChange}/></div>
        <section className="pdt-goals">{goals.map((goal, index) => <article className="pdt-goal-card" key={goal.id}><header><span className="pdt-goal-number">{index + 1}</span><div className="pdt-goal-title"><input aria-label={`Titre de l’objectif ${index + 1}`} disabled={!canEditGoals} value={goal.title} onChange={event => updateGoal(goal, 'title', event.currentTarget.value)}/><p><span className="pdt-demo-badge">{goal.role}</span><span className="pdt-demo-badge">Exemple fictif</span></p></div><span className="pdt-horizon-pill"><Clock3 size={14}/>{goal.horizonYears} ans</span></header><label className="pdt-goal-description"><span>Description du projet</span><textarea disabled={!canEditGoals} value={goal.description} onChange={event => updateGoal(goal, 'description', event.currentTarget.value)} rows={2}/></label></article>)}</section>
        <Timeline goals={goals}/>
        <p className="pdt-legal-note">L’objectif, le montant et l’horizon sont des informations de contexte; cette interface ne recommande pas de placement et ne lance aucune transaction.</p>
      </>}

      {view === 'situation' && <SituationPanel situation={situation}/>}

      {view === 'risk' && <>
        <header className="pdt-page-title"><div><span className="pdt-icon-tile pdt-large"><Activity size={22}/></span><div><h2>Risque et capacité à absorber une perte</h2><p>La réaction émotionnelle et la capacité financière ne sont pas interchangeables.</p></div></div><span className="pdt-demo-badge">Aucune note automatique</span></header>
        <div className="pdt-risk-grid"><ProfileField field="riskTolerance" profile={profile} onChange={onChange}/><ProfileField field="lossCapacity" profile={profile} onChange={onChange}/></div>
        <section className="pdt-risk-explainer"><article><span className="pdt-icon-tile"><Activity size={18}/></span><div><h3>Tolérance au risque</h3><p>Comment la personne vit les variations et l’incertitude sur la valeur de ses placements.</p><strong>{profile.riskTolerance}</strong></div></article><article><span className="pdt-icon-tile"><ShieldCheck size={18}/></span><div><h3>Capacité financière à prendre un risque</h3><p>Quelles pertes pourraient compromettre les objectifs, les dépenses ou les besoins de liquidités?</p><strong>{profile.lossCapacity}</strong></div></article></section>
        <p className="pdt-footnote"><Info size={14}/>Le profil global doit être contextualisé et confirmé par la personne; cet écran ne constitue pas une évaluation réglementaire de convenance.</p>
      </>}

      {view === 'preferences' && <>
        <header className="pdt-page-title"><div><span className="pdt-icon-tile pdt-large"><SlidersHorizontal size={22}/></span><div><h2>Préférences et connaissances</h2><p>Déclarations personnelles, contraintes et familiarité avec les placements.</p></div></div></header>
        <div className="pdt-preference-grid"><ProfileField field="preferences" profile={profile} onChange={onChange}/><ProfileField field="constraints" profile={profile} onChange={onChange}/><ProfileField field="knowledge" profile={profile} onChange={onChange}/></div>
        <section className="pdt-preference-note"><span className="pdt-icon-tile"><Leaf size={19}/></span><div><strong>Préférences responsables</strong><p>Les intérêts ESG exprimés par la personne sont conservés comme préférence. Ils ne démontrent pas qu’un titre respecte un critère ESG.</p></div><BadgeCheck size={18}/></section>
      </>}

      {view === 'memory' && <>
        <header className="pdt-page-title"><div><span className="pdt-icon-tile pdt-large"><WalletCards size={22}/></span><div><h2>Mémoire du profil</h2><p>Les éléments retenus, leur origine et ce qui demeure à confirmer.</p></div></div></header>
        <section className="pdt-memory-callout"><span className="pdt-icon-tile"><LockKeyhole size={19}/></span><div><strong>Contrôlée par la personne</strong><p>Les déclarations viennent de la personne ou d’un exemple fictif. Les informations inconnues restent explicitement inconnues.</p></div></section>
        <div className="pdt-memory-list">{fieldOrder.map(key => <article key={key}><span className="pdt-memory-icon">{isProfileFieldMissing(profile[key]) ? <CircleHelp size={17}/> : <Check size={17}/>}</span><div><strong>{fieldLabels[key]}</strong><p>{isProfileFieldMissing(profile[key]) ? 'À préciser — aucune valeur déduite' : profile[key]}</p></div><span className="pdt-origin-pill">{profile.origins[key] || 'Déclaration'}</span><button type="button" aria-label={`Corriger ${fieldLabels[key]}`} disabled={busy} onClick={() => onDiscuss(`Je veux corriger ou préciser ma réponse « ${fieldLabels[key]} ». Demande-moi la nouvelle information au lieu de la déduire.`)}><Pencil size={15}/></button></article>)}</div>
        <p className="pdt-legal-note">Pour cette démonstration, les données sont des exemples fictifs séparés par persona. Aucune date de modification ni version technique n’est affichée ici.</p>
      </>}
    </div>
  </div>;
}
