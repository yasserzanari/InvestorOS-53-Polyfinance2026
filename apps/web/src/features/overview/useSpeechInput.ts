import { useEffect, useRef, useState } from 'react';

type SpeechResultEvent = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function useSpeechInput() {
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const prefix = useRef('');
  const [isListening, setIsListening] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => () => recognition.current?.stop(), []);

  function toggle(currentValue: string, onChange: (value: string) => void) {
    if (recognition.current && isListening) {
      recognition.current.stop();
      setIsListening(false);
      setNotice('');
      return;
    }

    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice('La dictée vocale n’est pas prise en charge par ce navigateur.');
      return;
    }

    try {
      const instance = new SpeechRecognition();
      prefix.current = currentValue.trim();
      instance.lang = 'fr-CA';
      instance.continuous = true;
      instance.interimResults = true;
      instance.onresult = (event) => {
        const transcript = Array.from(
          { length: event.results.length },
          (_, index) => event.results[index][0]?.transcript ?? '',
        ).join(' ').trim();
        onChange([prefix.current, transcript].filter(Boolean).join(' '));
      };
      instance.onerror = () => {
        setIsListening(false);
        setNotice('La dictée a été interrompue. Vérifiez la permission du microphone.');
      };
      instance.onend = () => setIsListening(false);
      recognition.current = instance;
      setNotice('Parlez maintenant…');
      setIsListening(true);
      instance.start();
    } catch {
      setIsListening(false);
      setNotice('Impossible de démarrer le microphone. Vérifiez les permissions du navigateur.');
    }
  }

  return { isListening, notice, toggle };
}
