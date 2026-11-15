import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { AdvancedChatInput } from '../../../shared/ui/advanced-ai-chat-input';
import { VoiceOrb } from './VoiceOrb';

/** Prompt bar with a live Amazon Transcribe socket and reactive voice orb. */
export function PromptBar({ value, onChange, onSend, busy = false, disabled = false, onStop, placeholder = 'Décrivez vos objectifs, posez une question…' }: {
  value: string; onChange: (value: string) => void; onSend: () => void; busy?: boolean; disabled?: boolean; onStop?: () => void; placeholder?: string;
}) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceSession, setVoiceSession] = useState(0);
  const [notice, setNotice] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => { if (busy) setRecording(false); }, [busy]);
  useEffect(() => {
    if (busy || !restoreFocus.current) return;
    const frame = window.requestAnimationFrame(() => {
      const input = rootRef.current?.querySelector<HTMLTextAreaElement>('textarea');
      if (input && (document.activeElement === document.body || rootRef.current?.contains(document.activeElement))) input.focus();
      restoreFocus.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy]);
  const stopVoice = () => { setVoiceOpen(false); setRecording(false); };
  const send = () => {
    if (busy || disabled || !value.trim()) return;
    restoreFocus.current = Boolean(rootRef.current?.contains(document.activeElement));
    if (!voiceOpen) stopVoice();
    onSend();
    setNotice('');
  };
  const finishVoiceTurn = () => {
    setRecording(false);
    if (value.trim()) send();
    else {
      setNotice('Je n’ai pas reçu de transcription. Je relance l’écoute.');
      setVoiceSession((session) => session + 1);
    }
  };
  return <div className="pw-prompt-root" ref={rootRef}>
    {voiceOpen&&(busy
      ? <div className="pw-voice-live" role="status" aria-live="polite"><div className="pw-voice-orb"><span/><span/><span/></div><strong>Analyse en cours…</strong><small>Votre question est envoyée. Le micro reprendra après la réponse.</small></div>
      : <VoiceOrb key={voiceSession} value={value} onChange={onChange} onRecordingChange={setRecording} onError={setNotice} onFinished={finishVoiceTurn}/>)}
    <AdvancedChatInput
      className="pw-shared-prompt"
      textareaProps={{
        value, disabled:busy||disabled, 'aria-label':'Message à l’assistant',
        placeholder:recording?'Votre transcription en direct apparaît ici…':placeholder,
        onChange:event=>onChange(event.currentTarget.value),
        onKeyDown:event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send();}},
      }}
      onSend={send}
      hideSendButton={busy}
      sendButtonProps={{disabled:disabled||!value.trim(), 'aria-label':'Envoyer le message'}}
      actionIcons={[
        <button key="microphone" type="button" className={`pw-prompt-mic${voiceOpen?' is-recording':''}`} disabled={disabled||(busy&&!voiceOpen)} aria-label={voiceOpen?'Arrêter le mode vocal':'Démarrer le mode vocal'} aria-pressed={voiceOpen} onClick={()=>{setNotice('');if(voiceOpen)stopVoice();else setVoiceOpen(true);}}>{voiceOpen?<Square size={16}/>:<Mic size={18}/>}</button>,
        <span key="hint" className="pw-prompt-hint">{recording?'Écoute en direct · Amazon Transcribe':'Entrée pour envoyer'}</span>,
        ...(busy?[<button key="stop" type="button" className="pw-prompt-mic" onClick={onStop} aria-label="Arrêter la réponse"><Square size={16}/></button>]:[]),
      ]}
    />
    {notice&&<p role="status" className="pw-prompt-notice">{notice}</p>}
  </div>;
}
