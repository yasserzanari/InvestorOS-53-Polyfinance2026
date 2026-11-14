type MetricCardProps = {
  label: string;
  value: string;
  note: string;
  tone?: 'positive' | 'negative';
};

export function MetricCard({ label, value, note, tone }: MetricCardProps) {
  return <article className="portfolio-metric"><span>{label}</span><strong className={tone ? `portfolio-${tone}` : undefined}>{value}</strong><small>{note}</small></article>;
}
