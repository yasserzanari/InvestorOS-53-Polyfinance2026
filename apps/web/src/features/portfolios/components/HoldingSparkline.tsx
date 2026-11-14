type HoldingSparklineProps = { values: number[]; color: string };

export function HoldingSparkline({ values, color }: HoldingSparklineProps) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const points = values.map((value, index) => `${index ? 'L' : 'M'}${index / Math.max(1, values.length - 1) * 112},${22 - (value - minimum) / (maximum - minimum || 1) * 18}`).join(' ');
  return <svg className="holding-sparkline" viewBox="0 0 112 26" aria-hidden="true"><path d={points} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
