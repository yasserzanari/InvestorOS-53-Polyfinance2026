import { ArrowRight, CircleHelp, FilePlus2, Layers3, Sparkles, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productModules } from '../../app/modules';
import './dashboard.css';

const steps = [
  { n: '01', title: 'Créer un profil investisseur', body: 'Définir objectifs, échéances, capacité à absorber une perte et préférences.', href: '/app/profiles', Icon: UsersRound },
  { n: '02', title: 'Examiner un portefeuille', body: 'Comprendre les positions et les expositions avant de comparer une idée.', href: '/app/portfolios', Icon: Layers3 },
  { n: '03', title: 'Lancer une analyse', body: 'Suivre les étapes, les sources, les hypothèses et les limites ensemble.', href: '/app/analyses', Icon: FilePlus2 },
];

export function DashboardPage() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div><h1>Votre espace de décision</h1><p>Commencez par le besoin de l’investisseur. L’analyse se construit ensuite autour des preuves.</p></div>
        <Link className="dashboard-primary-action" to="/app/profiles"><Sparkles size={16} /> Créer un profil <ArrowRight size={16} /></Link>
      </header>
      <section className="dashboard-start" aria-labelledby="start-title">
        <div className="start-copy"><span className="start-icon"><Sparkles size={18} /></span><h2 id="start-title">Bâtissez le contexte avant la conclusion.</h2><p>Un profil confirmé aide InvestorOS à relier une question aux objectifs, à l’horizon et aux contraintes qui comptent.</p><Link to="/app/profiles" className="text-action">Commencer le profil <ArrowRight size={15} /></Link></div>
        <div className="start-steps" aria-label="Parcours recommandé">{steps.map(({ n, title, body, href, Icon }) => <Link className="start-step" to={href} key={n}><span className="step-number">{n}</span><span className="step-icon"><Icon size={17} /></span><span className="step-copy"><strong>{title}</strong><small>{body}</small></span><ArrowRight className="step-arrow" size={16} /></Link>)}</div>
      </section>
      <section className="dashboard-lower" aria-label="Modules disponibles">
        <div className="module-list-panel"><div className="section-heading"><div><h2>Modules</h2><p>Chaque espace a un rôle précis dans le parcours d’analyse.</p></div><CircleHelp size={18} aria-hidden="true" /></div><div className="module-list">{productModules.filter((module) => module.id !== 'overview').map(({ id, label, description, href, icon: Icon }) => <Link className="module-row" to={href} key={id}><span className="module-icon"><Icon size={17} /></span><span className="module-row-copy"><strong>{label}</strong><small>{description}</small></span><ArrowRight size={15} className="module-arrow" /></Link>)}</div></div>
        <aside className="analysis-empty"><div className="empty-glyph"><FilePlus2 size={20} /></div><h2>Vos analyses apparaîtront ici</h2><p>Une analyse sera créée après avoir choisi un profil et formulé une décision à examiner.</p><Link className="text-action" to="/app/analyses">Voir le parcours d’analyse <ArrowRight size={15} /></Link><div className="empty-footnote">Les métriques et graphiques s’afficheront lorsqu’ils seront reliés à des données vérifiables.</div></aside>
      </section>
    </div>
  );
}

export function ModuleLanding({ moduleId }: { moduleId: string }) {
  const module = productModules.find(({ id }) => id === moduleId);
  if (!module) return null;
  const Icon = module.icon;
  return <section className="module-placeholder"><span className="module-placeholder-icon"><Icon size={21} /></span><h1>{module.label}</h1><p>{module.description}</p><div className="module-placeholder-note">Cet espace est prêt à accueillir son flux de travail. Les données et actions apparaîtront ici lorsqu’elles seront reliées à une source réelle.</div><Link className="text-action" to="/app">Retour à la vue d’ensemble <ArrowRight size={15} /></Link></section>;
}
