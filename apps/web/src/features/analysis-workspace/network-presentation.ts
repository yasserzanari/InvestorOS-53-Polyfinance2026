import type { AnalysisResult, Entity } from './types';
export const networkKinds = { supplier: 'Fournisseur', component: 'Composant', site: 'Site', port: 'Port', product: 'Produit', policy: 'Politique' };
export type NetworkRole = { id: string; label: string; category: string; supplierIds: string[]; color: string };
export function documentedRoles(result: AnalysisResult): NetworkRole[] {
  const definitions = [
    { id: 'wafers', label: 'Fabrication de wafers', category: 'Fondeur', pattern: /wafers|fondeur|foundr/i, color: '#4778d6' },
    { id: 'memory', label: 'Mémoire', category: 'Mémoire', pattern: /mémoire|memory/i, color: '#8a67bc' },
    { id: 'assembly', label: 'Assemblage, test et conditionnement', category: 'Assemblage', pattern: /assembl|conditionnement|packag/i, color: '#2e9689' },
  ];
  return definitions.flatMap(definition => {
    const supplierIds = result.entities.filter(entity => entity.kind === 'supplier' && result.relations.some(edge => (edge.source === entity.id || edge.target === entity.id) && definition.pattern.test(edge.label))).map(entity => entity.id);
    return supplierIds.length ? [{ ...definition, supplierIds }] : [];
  });
}
export function focalEntity(result: AnalysisResult): Entity | undefined {
  const incoming = (id: string) => result.relations.filter(edge => edge.target === id).length;
  return [...result.entities].filter(entity => entity.kind !== 'supplier').sort((a, b) => incoming(b.id) - incoming(a.id))[0];
}
export function graphLayout(entities: Entity[], result: AnalysisResult, width: number, mode: 'dependencies' | 'propagation') {
  const cardWidth = width < 470 ? 214 : 226;
  const gap = 38;
  const columns = Math.max(1, Math.min(4, Math.floor((width - 38 + gap) / (cardWidth + gap))));
  const focal = focalEntity(result);
  const other = entities.filter(entity => entity.id !== focal?.id);
  const columnWidth = cardWidth + gap;
  const actualColumns = Math.min(columns, Math.max(1, other.length));
  const contentWidth = actualColumns * columnWidth - gap;
  const positions: Record<string, { x: number; y: number }> = {};
  if (focal && entities.some(entity => entity.id === focal.id)) positions[focal.id] = { x: (contentWidth - cardWidth) / 2, y: 0 };
  other.forEach((entity, index) => { positions[entity.id] = { x: index % actualColumns * columnWidth, y: (focal && positions[focal.id] ? 208 : 0) + Math.floor(index / actualColumns) * 190 }; });
  const contentHeight = Math.max(190, ...Object.values(positions).map(position => position.y + 160));
  return { positions, cardWidth, contentWidth, contentHeight, focalId: focal?.id, mode };
}
