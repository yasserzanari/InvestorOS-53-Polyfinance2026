/** Remove repeated demo markers from labels while keeping the portfolio-level disclosure. */
export function portfolioDisplayLabel(label: string): string {
  return label
    .replace(/\s*\(([^)]*(?:fictif|fixture)[^)]*)\)/gi, '')
    .replace(/\s*[·•]\s*(?:fictif|fixture)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
