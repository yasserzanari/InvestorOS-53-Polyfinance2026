import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square, X } from 'lucide-react';
import { cn } from '../../../shared/utils';

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

/** Prompt bar composed from the supplied prompt-box pattern, with actual browser dictation. */
export function PromptBar({ value, onChange, onSend, busy = false, onStop, placeholder = 'Décrivez vos objectifs, posez une question…' }: {
  value: string; onChange: (value: string) => void; onSend: () => void; busy?: boolean; onStop?: () => void; placeholder?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const prefix = useRef('');
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  useEffect(() => { const el = textarea.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(150, el.scrollHeight)}px`; } }, [value]);
  useEffect(() => { if (!recording) return; const start = Date.now(); const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [recording]);
  useEffect(() => () => { recognition.current?.abort(); }, []);
  const startVoice = () => {
    const browser = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Engine = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Engine) { setNotice('La dictée n’est pas disponible dans ce navigateur.'); return; }
    prefix.current = value;
    const engine = new Engine(); recognition.current = engine;
    engine.lang = 'fr-CA'; engine.continuous = true; engine.interimResults = true;
    engine.onresult = (event) => { const parts = Array.from(event.results).map((result) => result[0].transcript); onChangeRef.current([prefix.current, ...parts].filter(Boolean).join(' ')); };
    engine.onerror = () => { setRecording(false); setNotice('Accès au microphone indisponible. Sur le réseau local, utilisez HTTPS pour autoriser la dictée.'); };
    engine.onend = () => { recognition.current = null; setRecording(false); };
    try { engine.start(); setSeconds(0); setRecording(true); setNotice(''); } catch { setNotice('Impossible de démarrer la dictée. Vérifiez les permissions du navigateur.'); }
  };
  const stopVoice = () => { recognition.current?.stop(); setRecording(false); };
  const send = () => { if (busy || !value.trim()) return; stopVoice(); onSend(); setNotice(''); };
  return <div className="pw-prompt-root w-full">
    <div className={cn('mx-auto w-full max-w-[680px] rounded-[22px] border border-neutral-200 bg-neutral-50/70 p-2 shadow-[0_2px_12px_rgba(0,0,0,0.035)] transition-colors focus-within:border-neutral-300', recording && 'border-rose-200 bg-rose-50/30')}>
      {recording && <div className="flex h-12 items-center justify-between gap-3 px-3"><span role="status" className="flex items-center gap-2 font-mono text-xs text-rose-600"><span className="size-1.5 rounded-full bg-rose-500 motion-safe:animate-pulse" />{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</span><span className="text-xs text-neutral-500">Dictée en cours</span><button type="button" aria-label="Arrêter la dictée" onClick={stopVoice} className="grid size-7 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"><X size={14} /></button></div>}
      <textarea ref={textarea} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} placeholder={recording ? 'Votre transcription apparaît ici…' : placeholder} rows={1} aria-label="Message à l’assistant" disabled={busy} className="block min-h-[46px] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-[13px] leading-6 text-neutral-800 outline-none placeholder:text-neutral-400 disabled:opacity-60" />
      <div className="flex items-center justify-between gap-2 px-1 pb-0.5"><span className="px-2 text-[11px] text-neutral-400">Entrée pour envoyer</span><div className="flex gap-1"><button type="button" disabled={busy} aria-label={recording ? 'Arrêter la dictée' : 'Dicter un message'} aria-pressed={recording} onClick={recording ? stopVoice : startVoice} title={recording ? 'Arrêter la dictée' : 'Dicter un message'} className={cn('grid size-8 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200/60 disabled:opacity-40', recording && 'bg-rose-100 text-rose-600')}>{recording ? <Square size={13} fill="currentColor" /> : <Mic size={16} />}</button><button type="button" onClick={busy ? onStop : send} disabled={!busy && !value.trim()} aria-label={busy ? 'Arrêter la réponse' : 'Envoyer le message'} title={busy ? 'Arrêter la réponse' : 'Envoyer'} className="grid size-8 place-items-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700 disabled:bg-neutral-200 disabled:text-neutral-400">{busy ? <Square size={12} fill="currentColor" /> : <ArrowUp size={17} />}</button></div></div>
    </div>
    {notice && <p role="status" className="mx-auto mt-2 max-w-[680px] text-xs text-amber-700">{notice}</p>}
  </div>;
}
