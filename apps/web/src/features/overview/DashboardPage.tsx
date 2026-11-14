import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeAlert, Check, ChevronDown,
  CircleHelp, Clock3, Command, Layers3, Mic, MicOff, Send, ShieldCheck,
  Sparkles, TrendingUp, UsersRound, WalletCards, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productModules } from '../../app/modules';
import './dashboard.css';

type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string };
type SpeechResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const demoStats = [
  { label: 'Valeur du portefeuille', value: '82 460 $', detail: 'Valeur de démonstration', Icon: WalletCards, tone: 'blue' },
  { label: 'Variation sur 7 jours', value: '+2,4 %', detail: '+1 936 $ · période simulée', Icon: TrendingUp, tone: 'green' },
  { label: 'Risque estimé', value: 'Modéré', detail: '64 / 100 · indicatif', Icon: ShieldCheck, tone: 'teal' },
  { label: 'Diversification', value: '72 / 100', detail: 'Concentration à revoir', Icon: Layers3, tone: 'amber' },
];

const chartPaths: Record<string, string> = {
  '1S': '0,103 34,97 68,105 102,80 136,86 170,68 204,76 238,53 272,61 306,48 340,58 374,32 408,42 442,23 476,34 510,14 544,20 578,6',
  '1M': '0,105 34,93 68,100 102,72 136,80 170,63 204,78 238,56 272,60 306,41 340,51 374,26 408,37 442,18 476,30 510,12 544,21 578,6',
  '3M': '0,112 34,90 68,97 102,77 136,85 170,61 204,68 238,47 272,59 306,35 340,48 374,27 408,35 442,15 476,29 510,13 544,18 578,6',
  '1A': '0,111 34,98 68,105 102,88 136,79 170,91 204,68 238,74 272,54 306,63 340,39 374,48 408,28 442,36 476,18 510,25 544,10 578,6',
};
const timeRanges = ['1S', '1M', '3M', '1A'];
const modules = productModules.filter((module) => module.id !== 'overview');

function DemoChart({ range }: { range: string }) {
  const points = chartPaths[range];
  return (
    <div className="portfolio-chart" aria-label={`Évolution simulée du portefeuille sur ${range}`}>
      <svg viewBox="0 0 578 132" preserveAspectRatio="none" role="img" aria-label="Graphique de portefeuille simulé">
        <defs>
          <linearGradient id="portfolio-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3975e9" stopOpacity=".24" />
            <stop offset="100%" stopColor="#3975e9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${points.replaceAll(' ', ' L')} L578 132 L0 132 Z`} fill="url(#portfolio-chart-fill)" />
        <polyline points={points} fill="none" stroke="#3975e9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx="578" cy={points.split(' ').at(-1)?.split(',')[1] ?? '6'} r="4" fill="#3975e9" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-grid-lines" aria-hidden="true"><i /><i /><i /></div>
      <div className="chart-labels"><span>Début</span><span>+1,1 %</span><span>+1,8 %</span><span>Maintenant</span></div>
    </div>
  );
}

function Composer({
  onSend,
  value,
  onChange,
  placeholder,
  isListening,
  onToggleMic,
  notice,
  compact = false,
}: {
  onSend: () => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isListening: boolean;
  onToggleMic: () => void;
  notice: string;
  compact?: boolean;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <form className={`prompt-composer${compact ? ' is-compact' : ''}`} onSubmit={(event: FormEvent) => { event.preventDefault(); onSend(); }}>
      <div className="composer-topline">
        <Sparkles size={15} aria-hidden="true" />
        <span>{compact ? 'Demander à InvestorOS' : 'Votre copilote financier'}</span>
        <span className="composer-model"><span className="live-dot" /> Prêt à explorer</span>
      </div>
      <div className="composer-input-row">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          aria-label="Votre question"
          placeholder={placeholder}
        />
        <button type="button" className={`composer-mic${isListening ? ' is-listening' : ''}`} onClick={onToggleMic} aria-label={isListening ? 'Arrêter la dictée' : 'Dicter une question'} title={isListening ? 'Arrêter la dictée' : 'Dicter une question'}>
          {isListening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <button type="submit" className="composer-send" disabled={!value.trim()} aria-label="Envoyer la question" title="Envoyer">
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="composer-foot"><span>{notice || 'Entrée pour envoyer · Maj + Entrée pour aller à la ligne'}</span><span><Command size={11} /> Démonstration</span></div>
    </form>
  );
}

export function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<'overview' | 'chat'>('overview');
  const [prompt, setPrompt] = useState('');
  const [range, setRange] = useState('1M');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [notice, setNotice] = useState('');
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const voicePrefix = useRef('');

  const sendPrompt = () => {
    const text = prompt.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', text },
      { id: Date.now() + 1, role: 'assistant', text: 'Demande reçue. Je peux illustrer comment relier votre profil, les expositions du portefeuille et les sources à vérifier. Les chiffres et cette réponse sont simulés : aucune analyse réelle ni donnée AWS n’est encore connectée.' },
    ]);
    setPrompt('');
    setNotice('');
    setView('chat');
  };

  const toggleMicrophone = () => {
    if (recognition.current && isListening) {
      recognition.current.stop();
      setIsListening(false);
      return;
    }
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice('La dictée vocale n’est pas prise en charge par ce navigateur.');
      return;
    }
    try {
      const instance = new SpeechRecognition();
      instance.lang = 'fr-CA';
      instance.continuous = true;
      instance.interimResults = true;
      voicePrefix.current = prompt.trim();
      instance.onresult = (event) => {
        const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index][0]?.transcript ?? '').join(' ').trim();
        setPrompt([voicePrefix.current, transcript].filter(Boolean).join(' '));
      };
      instance.onerror = () => {
        setIsListening(false);
        setNotice('La dictée a été interrompue. Vérifiez l’accès au microphone et réessayez.');
      };
      instance.onend = () => setIsListening(false);
      recognition.current = instance;
      setNotice('Parlez maintenant…');
      setIsListening(true);
      instance.start();
    } catch {
      setIsListening(false);
      setNotice('Impossible de démarrer le microphone. Vérifiez les permissions du navigateur.');
    }
  };

  const resetChat = () => {
    setView('overview');
    setMessages([]);
  };

  return (
    <div className={`dashboard-page${view === 'chat' ? ' is-chat-view' : ''}`}>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'overview' ? (
          <motion.section
            key="overview"
            className="dashboard-overview-view"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            aria-label="Vue d’ensemble du portefeuille"
          >
            <header className="dashboard-heading">
              <div className="dashboard-title-block">
                <div className="dashboard-eyebrow"><span className="status-dot" /> VOTRE ESPACE INVESTISSEUR <span className="demo-chip">Données simulées</span></div>
                <h1>Bonjour, Yasser <span aria-hidden="true">✦</span></h1>
                <p>Une vue claire de votre portefeuille, de ses risques et des prochaines étapes.</p>
              </div>
              <div className="dashboard-header-actions">
                <button className="profile-select" type="button" aria-label="Sélectionner le profil de démonstration"><span className="mini-avatar">Y</span><span><small>Profil actif</small><strong>Investisseur équilibré</strong></span><ChevronDown size={15} /></button>
                <Link className="dashboard-primary-action" to="/app/profiles"><UsersRound size={15} /> Mon profil <ArrowRight size={15} /></Link>
              </div>
            </header>

            <section className="dashboard-stats" aria-label="Indicateurs de démonstration">
              {demoStats.map(({ label, value, detail, Icon, tone }, index) => (
                <article className={`stat-card tone-${tone}`} key={label}>
                  <div className="stat-icon"><Icon size={17} aria-hidden="true" /></div>
                  <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{index === 1 && <ArrowUpRight size={12} aria-hidden="true" />}{detail}</small></div>
                  {index === 0 && <span className="stat-period">CAD</span>}
                </article>
              ))}
            </section>

            <div className="dashboard-body">
              <section className="portfolio-panel dashboard-panel" aria-labelledby="portfolio-title">
                <div className="portfolio-panel-heading">
                  <div><div className="panel-overline"><span className="panel-live-dot" /> PORTFEUILLE · DÉMO</div><h2 id="portfolio-title">Évolution du portefeuille</h2><p>Lecture indicative · aucune donnée de compte connectée</p></div>
                  <button className="period-button" type="button" aria-label="Période d’affichage">30 derniers jours <ChevronDown size={14} /></button>
                </div>
                <div className="chart-value-row"><strong>82 460 $</strong><span className="positive-change"><ArrowUpRight size={14} /> +2,4 %</span><small>sur la période simulée</small></div>
                <DemoChart range={range} />
                <div className="portfolio-panel-footer"><span><span className="chart-legend-dot" /> Valeur estimée</span><div className="chart-range-picker" role="group" aria-label="Période du graphique">{timeRanges.map((item) => <button key={item} type="button" onClick={() => setRange(item)} aria-pressed={item === range}>{item}</button>)}</div></div>
              </section>

              <div className="dashboard-aside">
                <section className="attention-panel dashboard-panel" aria-labelledby="attention-title">
                  <div className="attention-heading"><div><div className="panel-overline attention-overline"><BadgeAlert size={13} /> LECTURE RAPIDE</div><h2 id="attention-title">Deux points à vérifier</h2></div><span className="attention-count">2</span></div>
                  <p className="attention-summary">La tendance de démo est positive. Confirmez l’exposition techno et la fraîcheur des cotations avant d’en tirer une conclusion.</p>
                  <Link className="attention-item" to="/app/portfolios"><span className="attention-icon amber-icon"><ArrowDownRight size={15} /></span><span className="attention-copy"><strong>Concentration technologique</strong><small>27 % de l’exemple de portefeuille · seuil illustratif 25 %</small></span><ArrowRight size={14} /></Link>
                  <Link className="attention-item" to="/app/sources"><span className="attention-icon blue-icon"><Clock3 size={15} /></span><span className="attention-copy"><strong>Fraîcheur des données</strong><small>Confirmer la date des cotations avant toute conclusion</small></span><ArrowRight size={14} /></Link>
                </section>

                <section className="modules-panel dashboard-panel" aria-labelledby="modules-title">
                  <div className="modules-heading"><div><div className="panel-overline">VOTRE ESPACE DE TRAVAIL</div><h2 id="modules-title">Explorer les modules</h2></div><Link to="/app/analyses" aria-label="Voir les analyses"><ArrowRight size={15} /></Link></div>
                  <div className="dashboard-module-grid">
                    {modules.map(({ id, label, shortLabel, description, href, icon: Icon }) => (
                      <Link className="dashboard-module-card" to={href} key={id}>
                        <span className={`dashboard-module-icon module-tone-${id}`}><Icon size={16} aria-hidden="true" /></span>
                        <span className="dashboard-module-copy"><strong>{shortLabel || label}</strong><small>{description}</small></span>
                        <ArrowRight className="dashboard-module-arrow" size={13} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="dashboard-composer-slot">
              <Composer
                onSend={sendPrompt}
                value={prompt}
                onChange={setPrompt}
                placeholder="Ex. Quels risques devrais-je examiner dans mon portefeuille?"
                isListening={isListening}
                onToggleMic={toggleMicrophone}
                notice={notice}
              />
              <p className="dashboard-data-note"><CircleHelp size={12} /> Données fictives pour la démonstration · les analyses réelles seront reliées à des sources vérifiables.</p>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="chat"
            className="dashboard-chat-view"
            initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <section className="chat-main-panel" aria-label="Conversation avec InvestorOS">
              <header className="chat-panel-header"><div><button type="button" className="chat-back-button" onClick={resetChat}><ArrowRight size={16} /> Tableau de bord</button><div className="chat-title-row"><span className="chat-agent-icon"><Sparkles size={17} /></span><span><strong>Votre espace d’analyse</strong><small><span className="status-dot" /> Session de démonstration</small></span></div></div><button type="button" className="chat-close-button" onClick={resetChat} aria-label="Fermer la conversation"><X size={17} /></button></header>
              <div className="chat-transcript" aria-live="polite">
                <div className="chat-date-divider"><span /> AUJOURD’HUI <span /></div>
                {messages.map((message) => message.role === 'user' ? (
                  <div className="chat-message user-message" key={message.id}><span className="chat-user-avatar">Y</span><p>{message.text}</p></div>
                ) : (
                  <div className="chat-message assistant-message" key={message.id}><span className="chat-agent-avatar"><Sparkles size={15} /></span><div><div className="assistant-message-meta"><strong>InvestorOS</strong><span>Réponse de démonstration</span></div><p>{message.text}</p><div className="chat-response-tags"><span><Check size={11} /> Hypothèses visibles</span><span><ShieldCheck size={11} /> Sources à vérifier</span></div></div></div>
                ))}
              </div>
              <Composer onSend={sendPrompt} value={prompt} onChange={setPrompt} placeholder="Posez une autre question…" isListening={isListening} onToggleMic={toggleMicrophone} notice={notice} compact />
            </section>
            <aside className="chat-context-panel" aria-label="Contexte de l’analyse">
              <div className="context-header"><div><span className="panel-overline">CONTEXTE PARTAGÉ</span><h2>Votre portefeuille</h2></div><span className="demo-chip">Simulé</span></div>
              <div className="context-profile"><span className="context-avatar">Y</span><span><strong>Investisseur équilibré</strong><small>Profil de démonstration</small></span><ChevronDown size={14} /></div>
              <div className="context-total"><span>Valeur indicative</span><strong>82 460 $</strong><small>CAD · Données fictives</small></div>
              <div className="context-section-title"><span>Principales expositions</span><button type="button" aria-label="Voir le portefeuille"><ArrowRight size={14} /></button></div>
              <div className="exposure-list">
                <div className="exposure-row"><span className="exposure-color exposure-equity" /><span>Actions mondiales</span><strong>38 %</strong></div>
                <div className="exposure-row"><span className="exposure-color exposure-tech" /><span>Technologie</span><strong>27 %</strong></div>
                <div className="exposure-row"><span className="exposure-color exposure-bonds" /><span>Obligations</span><strong>18 %</strong></div>
                <div className="exposure-row"><span className="exposure-color exposure-cash" /><span>Liquidités</span><strong>17 %</strong></div>
              </div>
              <div className="context-alert"><BadgeAlert size={15} /><span><strong>Point à vérifier</strong><small>L’exposition techno dépasse le seuil indicatif de 25 %.</small></span></div>
              <Link className="context-link" to="/app/portfolios">Ouvrir le module Portefeuilles <ArrowRight size={14} /></Link>
            </aside>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ModuleLanding({ moduleId }: { moduleId: string }) {
  const module = productModules.find(({ id }) => id === moduleId);
  if (!module) return null;
  const Icon = module.icon;
  return <section className="module-placeholder"><span className="module-placeholder-icon"><Icon size={21} /></span><h1>{module.label}</h1><p>{module.description}</p><div className="module-placeholder-note">Cet espace est prêt à accueillir son flux de travail. Les données et actions apparaîtront ici lorsqu’elles seront reliées à une source réelle.</div><Link className="text-action" to="/app">Retour à la vue d’ensemble <ArrowRight size={15} /></Link></section>;
}
