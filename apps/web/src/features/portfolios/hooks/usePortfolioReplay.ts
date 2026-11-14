import { useEffect, useMemo, useState } from 'react';
import {
  getPortfolioSnapshot,
  getRebalancePreview,
  PORTFOLIO_STEPS,
  REPLAY_START_STEP,
} from '../model/portfolio-model';
import { downloadPortfolioCsv } from '../utils/exportPortfolioCsv';

export function usePortfolioReplay(accountName: string) {
  const [step, setStep] = useState(REPLAY_START_STEP);
  const [speed, setSpeed] = useState(4);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [manualSteps, setManualSteps] = useState<number[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [previewingRebalance, setPreviewingRebalance] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [exportComplete, setExportComplete] = useState(false);

  const snapshot = useMemo(() => getPortfolioSnapshot(step, manualSteps), [step, manualSteps]);
  const rebalancePreview = useMemo(() => getRebalancePreview(snapshot.positions), [snapshot.positions]);
  const selectedPosition = snapshot.positions.find((position) => position.symbol === selectedSymbol);
  const isPlaying = playing && step < PORTFOLIO_STEPS;

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (!isPlaying || !pageVisible || previewingRebalance) return;
    const timer = window.setInterval(() => setStep((current) => Math.min(PORTFOLIO_STEPS, current + 1)), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [isPlaying, pageVisible, previewingRebalance, speed]);

  useEffect(() => {
    if (!exportComplete) return;
    const timer = window.setTimeout(() => setExportComplete(false), 2200);
    return () => window.clearTimeout(timer);
  }, [exportComplete]);

  function togglePlayback() {
    if (step >= PORTFOLIO_STEPS) {
      setStep(0);
      setManualSteps([]);
      setPlaying(true);
      return;
    }
    setPlaying((current) => !current);
  }

  function resetReplay() {
    setPlaying(false);
    setStep(REPLAY_START_STEP);
    setManualSteps([]);
    setSelectedSymbol(null);
    setPreviewingRebalance(false);
  }

  function pausePlayback() {
    setPlaying(false);
  }

  function seekReplay(nextStep: number) {
    setPlaying(false);
    setStep(nextStep);
    setPreviewingRebalance(false);
  }

  function applyManualRebalance() {
    setManualSteps((current) => current.includes(step) ? current : [...current, step]);
    setPreviewingRebalance(false);
  }

  function exportCurrentSnapshot() {
    downloadPortfolioCsv(snapshot, accountName);
    setExportComplete(true);
  }

  return {
    snapshot,
    rebalancePreview,
    selectedPosition,
    selectedSymbol,
    setSelectedSymbol,
    step,
    speed,
    setSpeed,
    isPlaying,
    togglePlayback,
    pausePlayback,
    resetReplay,
    seekReplay,
    previewingRebalance,
    setPreviewingRebalance,
    applyManualRebalance,
    exportCurrentSnapshot,
    exportComplete,
  };
}
