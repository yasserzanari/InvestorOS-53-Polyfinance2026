import type { ToolEvent } from '../../profile-api';

const labels:Record<string,string>={search_skills:'Recherche de la méthode',load_skill:'Chargement de la méthode',analyze_demo_portfolio:'Lecture du portefeuille',render_portfolio_widget:'Préparation du graphique'};

export function WidgetActivity({tools}:{tools:ToolEvent[]}) {
  const steps=tools.filter(tool=>labels[tool.name]);
  if(!steps.length)return null;
  return <details className="pw-widget-activity"><summary>Méthode et données consultées</summary><ul>{steps.map(step=><li key={step.id}>{labels[step.name]} · {step.status==='done'?'Terminé':step.status==='failed'?'Échec':'En cours'}</li>)}</ul></details>;
}
