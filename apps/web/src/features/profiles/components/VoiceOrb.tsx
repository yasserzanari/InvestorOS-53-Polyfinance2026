import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../../../shared/auth';
import { profileApiBase } from '../profile-api';

type Props = { value: string; onChange: (value: string) => void; onRecordingChange: (active: boolean) => void; onError: (message: string) => void };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function put32(view: DataView, offset: number, value: number) { view.setUint32(offset, value, false); }
function stringHeader(name: string, value: string) {
  const n = encoder.encode(name), v = encoder.encode(value), bytes = new Uint8Array(1 + n.length + 1 + 2 + v.length);
  const view = new DataView(bytes.buffer); let i = 0;
  bytes[i++] = n.length; bytes.set(n, i); i += n.length; bytes[i++] = 7; view.setUint16(i, v.length, false); i += 2; bytes.set(v, i);
  return bytes;
}
function eventFrame(payload: Uint8Array) {
  const headers = [stringHeader(':content-type', 'application/octet-stream'), stringHeader(':event-type', 'AudioEvent'), stringHeader(':message-type', 'event')];
  const headerBytes = headers.reduce((sum, h) => sum + h.length, 0), total = 16 + headerBytes + payload.length;
  const result = new Uint8Array(total), view = new DataView(result.buffer); put32(view, 0, total); put32(view, 4, headerBytes); put32(view, 8, crc32(result.subarray(0, 8)));
  let offset = 12; for (const h of headers) { result.set(h, offset); offset += h.length; }
  result.set(payload, offset); put32(view, total - 4, crc32(result.subarray(0, total - 4))); return result;
}
function readHeaders(bytes: Uint8Array, end: number) {
  const headers: Record<string, string> = {}; let offset = 12;
  while (offset < end) {
    const nameLength = bytes[offset++], name = decoder.decode(bytes.subarray(offset, offset + nameLength)); offset += nameLength;
    const kind = bytes[offset++];
    if (kind === 7) { const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, false); offset += 2; headers[name] = decoder.decode(bytes.subarray(offset, offset + length)); offset += length; }
    else if (kind === 6) { const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, false); offset += 2 + length; }
    else if (kind === 2) offset += 1;
    else if (kind === 3) offset += 2;
    else if (kind === 4) offset += 4;
    else if (kind === 5 || kind === 8) offset += 8;
    else if (kind === 0 || kind === 1) { /* boolean header */ }
    else throw new Error('Format de transcription AWS inconnu.');
  }
  return headers;
}

/** Mic audio is streamed as 16 kHz PCM to a short-lived, server-signed Amazon Transcribe socket. */
export function VoiceOrb({ value, onChange, onRecordingChange, onError }: Props) {
  const [active, setActive] = useState(false); const [level, setLevel] = useState(0); const [label, setLabel] = useState('Connexion à la transcription AWS…');
  const alive = useRef(false); const resources = useRef<{stream?:MediaStream;context?:AudioContext;socket?:WebSocket;processor?:ScriptProcessorNode;source?:MediaStreamAudioSourceNode;mute?:GainNode}>({});
  const prefix = useRef(value); const finalText = useRef(''); const callbacks = useRef({onChange,onRecordingChange,onError}); callbacks.current={onChange,onRecordingChange,onError};
  const startRef = useRef<() => Promise<void>>(async()=>undefined);
  const cleanup = () => { const r=resources.current; r.processor?.disconnect();r.source?.disconnect();r.mute?.disconnect();r.context?.close().catch(()=>{});r.stream?.getTracks().forEach(t=>t.stop());if(r.socket&&r.socket.readyState<2)r.socket.close();resources.current={}; };
  const stop = () => { alive.current=false; cleanup(); setActive(false); callbacks.current.onRecordingChange(false); };
  const start = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { onError('Le micro nécessite HTTPS et une permission du navigateur.'); return; }
    prefix.current=value; finalText.current=''; alive.current=true; setLabel('Demande d’accès au micro…');
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}}); resources.current.stream=stream;
      if(!alive.current){cleanup();return;}
      setLabel('Connexion sécurisée à Amazon Transcribe…');
      const response=await authenticatedFetch(`${profileApiBase}/v1/profiles/voice/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)});
      if(!response.ok) {
        const detail=await response.json().catch(()=>null) as {detail?:unknown}|null;
        throw new Error(typeof detail?.detail==='string'?detail.detail:response.status===403?'Votre session ne peut pas ouvrir la transcription AWS.':'Le service de transcription AWS est indisponible.');
      }
      const {url,sampleRate}=await response.json() as {url:string;sampleRate:number};
      if(!url||!Number.isFinite(sampleRate))throw new Error('La session de transcription AWS est incomplète.');
      const socket=new WebSocket(url);socket.binaryType='arraybuffer';resources.current.socket=socket;
      await new Promise<void>((resolve,reject)=>{
        const timeout=window.setTimeout(()=>reject(new Error('Amazon Transcribe ne répond pas. Vérifiez le réseau puis relancez le micro.')),12000);
        socket.onopen=()=>{window.clearTimeout(timeout);resolve();};
        socket.onerror=()=>{window.clearTimeout(timeout);reject(new Error('Connexion à Amazon Transcribe refusée. Vérifiez la session et les autorisations AWS.'));};
        socket.onclose=()=>{window.clearTimeout(timeout);reject(new Error('Amazon Transcribe a fermé la connexion avant le démarrage.'));};
      });
      if(!alive.current){cleanup();return;}
      const context=new AudioContext({sampleRate}); await context.resume(); resources.current.context=context;
      const source=context.createMediaStreamSource(stream), processor=context.createScriptProcessor(4096,1,1), mute=context.createGain(); mute.gain.value=0; resources.current.source=source;resources.current.processor=processor;resources.current.mute=mute;
      let lastLevel=0;
      processor.onaudioprocess=(event)=>{
        if(!alive.current||socket.readyState!==WebSocket.OPEN)return;
        const input=event.inputBuffer.getChannelData(0), pcm=new Int16Array(input.length); let energy=0;
        for(let i=0;i<input.length;i++){const sample=Math.max(-1,Math.min(1,input[i]));energy+=sample*sample;pcm[i]=sample<0?sample*32768:sample*32767;}
        const measured=Math.min(1,Math.sqrt(energy/input.length)*4); if(Math.abs(measured-lastLevel)>.025){lastLevel=measured;setLevel(measured);}
        socket.send(eventFrame(new Uint8Array(pcm.buffer)));
      };
      source.connect(processor);processor.connect(mute);mute.connect(context.destination);setActive(true);setLabel('Parlez, votre transcription apparaît ici');callbacks.current.onRecordingChange(true);callbacks.current.onError('');
      socket.onmessage=(message)=>{
        if(!(message.data instanceof ArrayBuffer))return;
        try{
          const frame=new Uint8Array(message.data), view=new DataView(frame.buffer), total=view.getUint32(0,false), headerLength=view.getUint32(4,false);
          if(total>frame.length||total<16)return;
          const headers=readHeaders(frame,12+headerLength), body=decoder.decode(frame.subarray(12+headerLength,total-4));
          if(headers[':message-type']==='exception')throw new Error(body||'Amazon Transcribe a interrompu le flux.');
          if(headers[':event-type']!=='TranscriptEvent')return;
          const data=JSON.parse(body), result=data.Transcript?.Results?.[0], text=result?.Alternatives?.[0]?.Transcript;
          if(!text)return;
          if(result.IsPartial){callbacks.current.onChange([prefix.current,finalText.current,text].filter(Boolean).join(' '));}
          else{finalText.current=[finalText.current,text].filter(Boolean).join(' ');callbacks.current.onChange([prefix.current,finalText.current].filter(Boolean).join(' '));}
        }catch(error){if(error instanceof Error){callbacks.current.onError(error.message);stop();}}
      };
      socket.onclose=()=>{if(alive.current){callbacks.current.onError('Le flux Amazon Transcribe est fermé. Relancez le micro.');stop();}};
    }catch(error){stop();onError(error instanceof Error?error.message:'Impossible de démarrer le micro. Vérifiez sa permission.');}
  },[value,onError]);
  startRef.current=start;
  useEffect(()=>{void startRef.current();return()=>{alive.current=false;cleanup();};},[]);
  return <div className="pw-voice-live" role="status" aria-live="polite">
    <button type="button" className="pw-voice-close" aria-label="Arrêter le micro" onClick={stop}>×</button>
    <div className={`pw-voice-orb${active?' is-listening':''}`} style={{'--voice-level':level} as React.CSSProperties}><span/><span/><span/></div>
    <strong>{label}</strong><small>{active?'Amazon Transcribe · Français (Canada)':'Préparation sécurisée du micro'}</small>
  </div>;
}
