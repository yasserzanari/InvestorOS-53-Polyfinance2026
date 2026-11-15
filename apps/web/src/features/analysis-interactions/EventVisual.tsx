import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, AudioLines, CalendarDays, CircleDollarSign, FileText, Landmark, Newspaper, Split, TrendingUp } from 'lucide-react';
import type { ExplorationTarget } from './types';
import { sourceUrl } from './presentation';

export function eventCategory(target: ExplorationTarget) {
  if (target.kind === 'movement') return target.movement?.direction === 'down' ? { label: 'Baisse importante', Icon: ArrowDownRight, color: '#b75e59' } : { label: 'Hausse importante', Icon: ArrowUpRight, color: '#278673' };
  const text = `${target.title} ${target.source?.publisher || ''}`.toLowerCase();
  if (/dividende/.test(text)) return { label: 'Dividende', Icon: CircleDollarSign, color: '#16836c' };
  if (/fractionnement/.test(text)) return { label: 'Fractionnement', Icon: Split, color: '#a46c1d' };
  if (target.kind === 'conclusion') return { label: 'Analyse', Icon: TrendingUp, color: '#356ce0' };
  if (/federal|bls|bureau|inflation|employment|macro/.test(text)) return { label: 'Économie', Icon: Landmark, color: '#a46c1d' };
  if (/10-[kq]|8-k|edgar|sec ·/.test(text)) return { label: 'Document financier', Icon: FileText, color: '#63748f' };
  if (/results|résultats|conference|conférence/.test(text)) return { label: 'Résultats & conférence', Icon: AudioLines, color: '#7357bb' };
  if (/nvidia|press|communiqué|board|transition/.test(text)) return { label: 'Annonce officielle', Icon: Newspaper, color: '#7357bb' };
  return { label: 'Actualité', Icon: CalendarDays, color: '#7357bb' };
}
export function EventVisual({ target, className = '' }: { target: ExplorationTarget; className?: string }) {
  const [failed, setFailed] = useState<string>();
  const url = sourceUrl(target.imageUrl);
  const { Icon } = eventCategory(target);
  return <span className={`event-visual ${className.replace(/\bhas-image\b/g,'')} ${url&&failed!==url&&className.includes('has-image')?'has-image':''}`}>
    {url && failed !== url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : <Icon size={18} aria-hidden="true" />}
  </span>;
}
