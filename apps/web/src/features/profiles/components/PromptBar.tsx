import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { AdvancedChatInput } from '../../../shared/ui/advanced-ai-chat-input';

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

/** Prompt bar composed from the supplied prompt-box pattern, with actual browser dictation. */
export function PromptBar({ value, onChange, onSend, busy = false, disabled = false, onStop, placeholder = 'Décrivez vos objectifs, posez une question…' }: {
  value: string; onChange: (value: string) => void; onSend: () => void; busy?: boolean; disabled?: boolean; onStop?: () => void; placeholder?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const prefix = useRef('');
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  useEffect(() => { if (!recording) return; const start = Date.now(); const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [recording]);
  useEffect(() => () => { recognition.current?.abort(); }, []);
  useEffect(() => {
    if (busy || !restoreFocus.current) return;
    const frame = window.requestAnimationFrame(() => {
      const input = rootRef.current?.querySelector<HTMLTextAreaElement>('textarea');
      if (input && (document.activeElement === document.body || rootRef.current?.contains(document.activeElement))) input.focus();
      restoreFocus.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy]);
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
  const send = () => { if (busy || disabled || !value.trim()) return; restoreFocus.current = Boolean(rootRef.current?.contains(document.activeElement)); stopVoice(); onSend(); setNotice(''); };
  return <div className="pw-prompt-root" ref={rootRef}>
    <AdvancedChatInput
      className="pw-shared-prompt"
      textareaProps={{
        value, disabled:busy||disabled, 'aria-label':'Message à l’assistant',
        placeholder:recording?'Votre transcription apparaît ici…':placeholder,
        onChange:event=>onChange(event.currentTarget.value),
        onKeyDown:event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send();}},
      }}
      onSend={send}
      hideSendButton={busy}
      sendButtonProps={{disabled:disabled||!value.trim(), 'aria-label':'Envoyer le message'}}
      actionIcons={[
        <button key="microphone" type="button" className={`pw-prompt-mic${recording?' is-recording':''}`} disabled={busy||disabled} aria-label={recording?'Arrêter la dictée':'Dicter un message'} aria-pressed={recording} onClick={recording?stopVoice:startVoice}>{recording?<Square size={16}/>:<Mic size={18}/>}</button>,
        <span key="hint" className="pw-prompt-hint">{recording?`Dictée en cours · ${seconds} s`:'Entrée pour envoyer'}</span>,
        ...(busy?[<button key="stop" type="button" className="pw-prompt-mic" onClick={onStop} aria-label="Arrêter la réponse"><Square size={16}/></button>]:[]),
      ]}
    />
    {notice&&<p role="status" className="pw-prompt-notice">{notice}</p>}
  </div>;
}
