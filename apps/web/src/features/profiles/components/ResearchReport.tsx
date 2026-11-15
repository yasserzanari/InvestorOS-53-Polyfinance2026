import { useState } from 'react';
import { CalendarDays, CheckCheck, CircleHelp, ShieldCheck } from 'lucide-react';
import type { ResearchEvidence, ResearchRun } from '../research-workspace';
import { SourceDetailsButton, type SourceDescription } from '../../analysis-interactions/SourceDetailsButton';
import { financialValue, fullDate, numberLabel, readableText, sourceUrl } from '../../analysis-interactions/presentation';
import './research-report.css';

export function evidenceContent(input: unknown): Record<string, unknown> {
  let value = input;
  for (let i = 0; i < 5 && typeof value === 'string'; i++) { try { value = JSON.parse(value); } catch { return { excerpt: value }; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function describeSource(proof: ResearchEvidence): SourceDescription {
  const content = evidenceContent(proof.content);
  return { id: proof.evidence_id, title: proof.source_name || proof.source_id, publisher: sourceUrl(proof.url)?new URL(proof.url!).hostname.replace(/^www\./,''):undefined, url: proof.url, collectedAt: proof.collected_at,
    excerpt: typeof content.excerpt === 'string' ? content.excerpt : typeof content.scope === 'string' ? content.scope : undefined, limits: proof.limits,
    documents: Array.isArray(content.documents) ? content.documents.filter(document => document && typeof document === 'object').map(raw => {
      const document = raw as Record<string, unknown>;
      return { title: String(document.title || document.form || 'Document officiel'), url: typeof document.url === 'string' ? document.url : undefined, date: typeof document.filingDate === 'string' ? document.filingDate : typeof document.published_at === 'string' ? document.published_at : undefined, excerpt: typeof document.excerpt === 'string' ? document.excerpt : undefined };
    }) : [] };
}
export function ResearchSources({ run, ids, label = 'Sources' }: { run: ResearchRun; ids?: string[]; label?: string }) {
  const proofs = (run.evidence || []).filter(proof => !ids || ids.includes(proof.evidence_id));
  return <SourceDetailsButton sources={proofs.map(describeSource)} label={label} />;
}
type FinancialMetric = { metric: string; label: string; value: number; unit: string; period_start?: string; period_end: string; filed?: string; form?: string };
function financialMetrics(value: unknown): FinancialMetric[] {
  return Array.isArray(value) ? value.filter((item): item is FinancialMetric => Boolean(item && typeof item === 'object' && typeof item.label === 'string' && typeof item.value === 'number' && Number.isFinite(item.value) && typeof item.unit === 'string' && typeof item.period_end === 'string')) : [];
}
function FinancialFacts({ run }: { run: ResearchRun }) {
  const [period, setPeriod] = useState<'quarterly_financials' | 'annual_financials'>('quarterly_financials');
  const proof = run.evidence?.find(item => item.source_id === 'sec-companyfacts');
  const data = evidenceContent(proof?.content);
  const quarterly = financialMetrics(data.quarterly_financials), annual = financialMetrics(data.annual_financials);
  const activePeriod=quarterly.length?period:'annual_financials';
  const metrics = activePeriod === 'quarterly_financials' ? quarterly : annual;
  const first = metrics[0];
  if (!quarterly.length && !annual.length) return null;
  return <section className="rr-facts"><div className="rr-financial-period" role="group" aria-label="Période des fondamentaux"><button type="button" aria-pressed={activePeriod === 'quarterly_financials'} disabled={!quarterly.length} onClick={() => setPeriod('quarterly_financials')}>Dernier trimestre</button><button type="button" aria-pressed={activePeriod === 'annual_financials'} disabled={!annual.length} onClick={() => setPeriod('annual_financials')}>Dernier exercice</button></div>
    {first && <p className="rr-period"><CalendarDays size={13} />{first.period_start ? `${fullDate(first.period_start)} – ` : 'Au '}{fullDate(first.period_end)}<span>{first.form}{first.filed ? ` · publié le ${fullDate(first.filed)}` : ''}</span></p>}
    <dl className="rr-metrics">{metrics.map(metric => <div key={metric.metric}><dt>{metric.label}</dt><dd title={`${numberLabel(metric.value)} ${metric.unit}`}>{financialValue(metric.value, metric.unit)}</dd>{!metric.period_start && <small>Au {fullDate(metric.period_end)}</small>}</div>)}</dl>
    {metrics.some(metric=>metric.unit==='USD'&&Math.abs(metric.value)>=1e9)&&<p className="rr-unit-note">G$ US : milliards de dollars américains.</p>}
    <details className="rr-exact"><summary>Valeurs exactes et périodes déclarées</summary><div><table><thead><tr><th>Indicateur</th><th>Valeur publiée</th><th>Période</th></tr></thead><tbody>{metrics.map(metric => <tr key={metric.metric}><th>{metric.label}</th><td>{numberLabel(metric.value)} {metric.unit}</td><td>{metric.period_start ? `${fullDate(metric.period_start)} – ` : 'Au '}{fullDate(metric.period_end)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
function ReportText({ text }: { text: string }) {
  return <div className="rr-text">{text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{readableText(paragraph)}</p>)}</div>;
}
export function ResearchReport({ run }: { run: ResearchRun }) {
  const result = run.result;
  if (!result) return null;
  const sections = result.sections || [];
  const hasFinancials = run.evidence?.some(item => item.source_id === 'sec-companyfacts' && financialMetrics(evidenceContent(item.content).quarterly_financials).length);
  return <div className="rr-root">
    <div className="rr-evidence-bar"><span><ShieldCheck size={15} />{run.evidence?.length || 0} sources collectées</span><ResearchSources run={run} label="Consulter les sources" /></div>
    {result.coverage && <details className="rr-coverage"><summary><span><CheckCheck size={16} />Vérification de l’analyse</span><span>{result.coverage.checks?.filter(check => check.status === 'covered').length || 0} / {result.coverage.checks?.length || 0} contrôles</span></summary><p>Couverture de la collecte : {result.coverage.status === 'sufficient' ? 'critères remplis' : 'partielle'}.</p><ul>{result.coverage.checks?.map(check => <li key={check.id}><span>{check.status === 'covered' ? 'Vérifié' : 'Manquant'}</span>{check.label}</li>)}</ul></details>}
    <section className="rr-section rr-summary"><header><h3>Synthèse</h3></header><ReportText text={result.summary || result.answer || 'Synthèse non fournie.'} /></section>
    {sections.map((section, index) => {
      if (result.summary?.includes(section.text.trim())) return null;
      const financial = Boolean(hasFinancials && /fondamentaux|données financières/i.test(section.title));
      return <section className="rr-section" key={`${section.title}-${index}`}><header><h3>{section.title}</h3>{section.evidence_ids?.length > 0 && <ResearchSources run={run} ids={section.evidence_ids} />}</header>{financial ? <FinancialFacts run={run} /> : <ReportText text={section.text} />}</section>;
    })}
    {!!result.claims?.length && <details className="rr-claims"><summary>Constats et niveau de preuve <span>{result.claims.length}</span></summary>{result.claims.map((claim, index) => <article key={index}><ReportText text={claim.text} /><footer><span>{claim.confidence === 'supported' ? 'Étayé' : claim.confidence === 'partial' ? 'Partiellement étayé' : 'À vérifier'}</span>{!!claim.evidence_ids?.length && <ResearchSources run={run} ids={claim.evidence_ids} />}</footer></article>)}</details>}
    {!!result.cautions?.length && <details className="rr-cautions"><summary><CircleHelp size={15} />Limites et informations à compléter <span>{result.cautions.length}</span></summary><ul>{result.cautions.map((caution, index) => <li key={index}>{readableText(caution)}</li>)}</ul></details>}
  </div>;
}
