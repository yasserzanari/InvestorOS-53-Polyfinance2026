import { Check, ChevronDown, Download, Pause, Play, RotateCcw, Wallet } from 'lucide-react';
import { PORTFOLIO_STEPS, type PortfolioSnapshot } from '../model/portfolio-model';
import { shortDate } from '../utils/format';

type PortfolioToolbarProps = {
  snapshot: PortfolioSnapshot;
  accountName: string;
  speed: number;
  isPlaying: boolean;
  exportComplete: boolean;
  onSpeedChange: (speed: number) => void;
  onTogglePlayback: () => void;
  onReset: () => void;
  onExport: () => void;
};

export function PortfolioToolbar({ snapshot, accountName, speed, isPlaying, exportComplete, onSpeedChange, onTogglePlayback, onReset, onExport }: PortfolioToolbarProps) {
  return (
    <header className="portfolio-toolbar">
      <div className="portfolio-heading">
        <Wallet size={19} />
        <div><h1>Portefeuille</h1><span>Modèle Croissance US · associé à {accountName}</span></div>
        <span className="portfolio-demo-tag">Simulation fictive</span>
      </div>
      <div className="portfolio-toolbar-actions">
        <time dateTime={snapshot.date}>{shortDate(snapshot.date)}</time>
        <span className={`portfolio-playback-state ${isPlaying ? 'is-running' : ''}`}>
          {snapshot.step >= PORTFOLIO_STEPS ? 'Relecture terminée' : isPlaying ? 'Relecture accélérée' : 'En pause'}
        </span>
        <button type="button" className="portfolio-icon-button" onClick={onTogglePlayback} aria-label={isPlaying ? 'Mettre en pause' : 'Démarrer la relecture'} title={isPlaying ? 'Pause' : 'Lecture'}>
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <label className="portfolio-speed"><span className="sr-only">Vitesse de relecture</span><select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}>{[1, 4, 12].map((value) => <option key={value} value={value}>{value}×</option>)}</select><ChevronDown size={12} aria-hidden="true" /></label>
        <button type="button" className="portfolio-icon-button" onClick={onReset} aria-label="Réinitialiser la simulation" title="Réinitialiser"><RotateCcw size={15} /></button>
        <button type="button" className="portfolio-export-button" onClick={onExport}>{exportComplete ? <Check size={15} /> : <Download size={15} />}<span>{exportComplete ? 'Exporté' : 'Exporter'}</span></button>
      </div>
    </header>
  );
}
