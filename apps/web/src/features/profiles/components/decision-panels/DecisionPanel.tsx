import { CircleHelp } from 'lucide-react';
import type { FieldKey, Profile } from '../../profile-model';
import type { Citation, WorkspaceTab } from '../../profile-api';
import { parseDecisionContent } from './decision-data';
import { InsightPanel } from './InsightPanel';
import { ComparisonPanel } from './ComparisonPanel';

export function DecisionPanel({ tab, profile, sources, onDiscuss, onChange, disabled, saveStatus }: {
  tab: WorkspaceTab; profile: Profile; sources: Citation[]; onDiscuss: (prompt: string) => void;
  onChange: (field: FieldKey, value: string) => void; disabled: boolean; saveStatus?: string;
}) {
  const data = parseDecisionContent(tab.content, tab.id);
  if (data?.type === 'insight') return <InsightPanel data={data} profile={profile} sources={sources} onDiscuss={onDiscuss} onChange={onChange} disabled={disabled} saveStatus={saveStatus}/>;
  if (data?.type === 'comparison') return <ComparisonPanel data={data}/>;
  return <section className="decision-insight" role="status"><header className="di-heading"><span className="di-symbol"><CircleHelp size={22}/></span><div><p>{tab.title}</p><h2>Cette synthèse est indisponible</h2></div></header><p>Le résultat enregistré est incomplet ou son format n’est pas reconnu. Demandez une nouvelle synthèse à l’assistant.</p><div className="di-question"><button type="button" disabled={disabled} onClick={() => onDiscuss(`Reprends le résultat de l’onglet « ${tab.title} » dans un format structuré, avec les données disponibles et leurs limites.`)}>Reprendre dans le chat</button></div></section>;
}
