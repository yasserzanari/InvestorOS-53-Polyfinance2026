import type { ComponentType } from 'react';
import type { AnalysisView, ViewProps } from './types';
import { ChronologyView } from './ChronologyView';
import { NetworkView } from './NetworkView';
import { ScenariosView } from './ScenariosView';
import { SimulatorView } from './SimulatorView';
export const analysisViewRenderers:Record<AnalysisView,ComponentType<ViewProps>>={
 chronology:ChronologyView,
 propagation:props=><NetworkView {...props} mode="propagation"/>,
 scenarios:ScenariosView,
 dependencies:props=><NetworkView {...props} mode="dependencies"/>,
 simulator:SimulatorView,
};
