import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '../analysis-workspace/ArchivedChart';
import { simulationEventOffset, simulationHorizon, simulationPointOffset, type SimulationProjection } from '../../shared/api';
import { scenarioMoney, scenarioPointTarget } from '../assistant/scenario-exploration';
import type { ExplorationTarget } from '../analysis-interactions/types';

export const branchColors = ['#356ce0', '#9a5bc2', '#148276', '#bd6b24'];

export function SimulationComparisonChart({ projection, selectedId, disabled, onExplore }: {
  projection: SimulationProjection; selectedId: string; disabled: boolean; onExplore: (target: ExplorationTarget) => void;
}) {
  const [pointIndex, setPointIndex] = useState(0);
  const selected = projection.branches.find(branch => branch.id === selectedId) ?? projection.branches[0];
  const selectedIndex = projection.branches.findIndex(branch => branch.id === selected.id);
  const rows = projection.branches[0].path.map((point, index) => ({
    offset: simulationPointOffset(point),
    band: [selected.path[index].lowerPrice, selected.path[index].upperPrice],
    ...Object.fromEntries(projection.branches.map((branch, branchIndex) => [`branch${branchIndex}`, branch.path[index].medianPrice])),
  }));
  const current = selected.path[Math.min(pointIndex, selected.path.length - 1)];
  const horizon = simulationHorizon(projection);
  return <div className="sw-plot">
    <ChartContainer className="sw-chart" config={{ band: { label: 'Fourchette p10–p90', color: branchColors[selectedIndex] } }} aria-label={`Comparaison des trajectoires de ${projection.ticker} sur ${horizon} séances`}>
      <ComposedChart data={rows} margin={{ top: 22, right: 18, left: 4, bottom: 4 }} onMouseMove={state => { if (typeof state.activeTooltipIndex === 'number') setPointIndex(state.activeTooltipIndex); }}>
        <CartesianGrid vertical={false} stroke="#e7edf5" strokeDasharray="3 5" />
        <XAxis dataKey="offset" type="number" domain={[0, horizon]} allowDecimals={false} minTickGap={30} tickFormatter={value => `+${value}`} tick={{ fill: '#6a7d98', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis domain={['auto', 'auto']} width={62} tickFormatter={value => Number(value).toLocaleString('fr-CA', { maximumFractionDigits: 0 })} tick={{ fill: '#6a7d98', fontSize: 11 }} tickLine={false} axisLine={false} />
        <ReferenceLine y={projection.startingPrice} stroke="#a7b7cd" strokeDasharray="4 4" />
        <Area type="linear" dataKey="band" stroke="none" fill={branchColors[selectedIndex]} fillOpacity={0.1} isAnimationActive={false} tooltipType="none" />
        {projection.branches.map((branch, index) => <Line key={branch.id} type="linear" dataKey={`branch${index}`} name={branch.title} stroke={branchColors[index]} strokeWidth={branch.id === selected.id ? 2.8 : 1.7} strokeDasharray={index === 0 && projection.branches.length > 1 ? '5 4' : undefined} dot={false} activeDot={{ r: 5, cursor: disabled ? 'default' : 'pointer', onClick: () => { if (!disabled) onExplore(scenarioPointTarget(projection, branch, branch.path[Math.min(pointIndex, branch.path.length - 1)])); } }} isAnimationActive={false} />)}
        {selectedIndex > 0 && <ReferenceLine x={simulationEventOffset(selected)} stroke={branchColors[selectedIndex]} strokeDasharray="3 4" label={{ value: 'Variation testée', position: 'insideTopRight', fill: branchColors[selectedIndex], fontSize: 10 }} />}
        <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="sw-tooltip"><strong>Après {label} séance{label === 1 ? '' : 's'}</strong>{projection.branches.map((branch, index) => <div key={branch.id}><span><i style={{ background: branchColors[index] }} />{branch.title}</span><b>{scenarioMoney(branch.path[Number(label)].medianPrice, projection.currency)}</b></div>)}<small>Fourchette de {selected.title} : {scenarioMoney(current.lowerPrice, projection.currency)} – {scenarioMoney(current.upperPrice, projection.currency)}</small></div> : null} />
      </ComposedChart>
    </ChartContainer>
    <div className="sw-plot-caption"><span><i style={{ background: branchColors[selectedIndex] }} />Zone colorée : p10–p90 de {selected.title}</span><span>Décalage en séances · {projection.currency}</span></div>
    <p className="sw-chart-note">Les lignes comparent les médianes calculées. La zone colorée représente la dispersion du modèle, pas une garantie sur le cours futur.</p>
  </div>;
}
