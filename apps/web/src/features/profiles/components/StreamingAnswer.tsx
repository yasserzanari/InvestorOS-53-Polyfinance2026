import { useState } from 'react';
import { TweetSource } from './TweetSource';
import type { PublicXPost, PublicXProfile } from '../../../shared/api';
import { CornerDownLeft, ExternalLink, Globe } from 'lucide-react';

export type Citation = { id: string; index: number; title: string; url: string; snippet?: string; xPost?: PublicXPost; xProfile?: PublicXProfile };
export type SuggestedPrompt = { id: string; label: string };

/** Controlled version of the user's StreamingText reference; sources come only from API results. */
export function StreamingAnswer({ text, streaming = false, citations = [], followUps = [], onFollowUp }: {
  text: string; streaming?: boolean; citations?: Citation[]; followUps?: SuggestedPrompt[]; onFollowUp?: (prompt: SuggestedPrompt) => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const safe = citations.filter((source) => /^https?:\/\//i.test(source.url));
  const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
  const parts = text.split(/(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean);
  return <div className="w-full min-w-0 text-[13.5px] leading-[1.7] text-neutral-700">
    <p className="whitespace-pre-wrap break-words">{parts.map((part, i) => {
      const linked = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (linked) {
        const source = safe.find(item => item.url === linked[2]);
        return source ? <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className="text-blue-600 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-600">{linked[1]}</a> : <span key={i}>{part}</span>;
      }
      if (part.startsWith('**') && part.endsWith('**')) return <strong className="font-semibold text-neutral-900" key={i}>{part.slice(2, -2)}</strong>;
      if (/^\[\d+\]$/.test(part)) {
        const source = safe.find((item) => item.index === Number(part.slice(1, -1)));
        return source ? <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className="mx-1 inline-flex h-[19px] -translate-y-px items-center gap-1 rounded-[5px] bg-neutral-100 px-1.5 align-middle font-mono text-[10.5px] text-neutral-600 ring-1 ring-inset ring-neutral-200 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-blue-500"><Globe size={10} />{domain(source.url)}</a> : <span key={i}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    })}{streaming && <span aria-hidden className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full bg-current motion-safe:animate-pulse" />}</p>
    {!streaming && safe.length > 0 && <>
      <button type="button" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((open) => !open)} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-blue-500"><Globe size={13} />Références utilisées <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{safe.length}</span></button>
      {sourcesOpen && <div className="mt-1 flex flex-col rounded-lg border border-neutral-200 bg-neutral-50 p-1">{safe.length ? safe.map((source) => source.xPost && source.xProfile ? <TweetSource key={source.id} source={source}/> : <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-start gap-2 rounded-md p-2 text-[12px] hover:bg-neutral-100"><Globe size={14} className="mt-0.5 shrink-0 text-neutral-400" /><span className="min-w-0 flex-1"><span className="font-medium text-neutral-800">{source.title}</span>{source.snippet && <span className="mt-0.5 block text-neutral-500">{source.snippet}</span>}<span className="block font-mono text-[10px] text-neutral-400">{domain(source.url)}</span></span><ExternalLink size={12} className="mt-1 shrink-0 text-neutral-400" /></a>) : <p className="px-2 py-2 text-[12px] text-neutral-500">Aucune référence n’a été transmise pour cette réponse.</p>}</div>}
    </>}
    {!streaming && followUps.length > 0 && <div className="mt-3"><p className="text-[12px] font-medium text-neutral-500">Pour continuer</p><div className="mt-0.5 flex flex-col">{followUps.map((prompt) => <button key={prompt.id} type="button" onClick={() => onFollowUp?.(prompt)} className="flex items-center gap-2 border-b border-neutral-100 py-2 text-left text-[12.5px] text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-blue-500"><CornerDownLeft size={12} className="shrink-0 text-neutral-400" />{prompt.label}</button>)}</div></div>}
  </div>;
}
