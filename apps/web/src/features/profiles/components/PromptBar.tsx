import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { AdvancedChatInput } from '../../../shared/ui/advanced-ai-chat-input';

type RecognitionError = 'not-allowed' | 'service-not-allowed' | 'audio-capture' | 'network' | 'no-speech' | 'aborted' | string;
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error?: RecognitionError }) => void) | null; onend: (() => void) | null };

function dictationErrorMessage(error: RecognitionError | undefined): string {
  if (!window.isSecureContext) return 'La dictée nécessite HTTPS ou localhost. Ouvrez cette page dans un contexte sécurisé.';
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Le navigateur bloque le microphone pour ce site. Autorisez-le dans les réglages du site, puis réessayez.';
    case 'audio-capture':
      return 'Aucun microphone accessible. Vérifiez qu’un micro est connecté et autorisé pour ce site.';
    case 'network':
      return 'Le service de dictée est indisponible. Vérifiez votre connexion Internet et réessayez.';
    case 'no-speech':
      return 'Aucune voix détectée. Réessayez en parlant près du microphone.';
    default:
      return 'La dictée a échoué. Vérifiez l’autorisation du microphone et les paramètres du navigateur.';
  }
}

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
    engine.onerror = (event) => { setRecording(false); if (event.error !== 'aborted') setNotice(dictationErrorMessage(event.error)); };
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
