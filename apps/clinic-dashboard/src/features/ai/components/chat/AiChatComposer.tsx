import { useRef, useState } from 'react';
import { Mic, MicOff, Paperclip, Send, Square } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import e from '../../ai-enterprise.module.css';

interface AiChatComposerProps {
  disabled?: boolean;
  loading?: boolean;
  streaming?: boolean;
  suggestions?: string[];
  voiceEnabled?: boolean;
  attachmentsEnabled?: boolean;
  onSend: (text: string, attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>) => void;
  onStop?: () => void;
}

export function AiChatComposer({
  disabled,
  loading,
  streaming,
  suggestions = [],
  voiceEnabled = false,
  attachmentsEnabled = true,
  onSend,
  onStop,
}: AiChatComposerProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Array<{ name: string; mimeType: string; dataUrl?: string }>>([]);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || loading || streaming) return;
    onSend(trimmed, attachments.length ? attachments : undefined);
    setText('');
    setAttachments([]);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || !attachmentsEnabled) return;
    const next: Array<{ name: string; mimeType: string; dataUrl?: string }> = [];
    for (const file of Array.from(files).slice(0, 3)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      next.push({ name: file.name, mimeType: file.type, dataUrl });
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const toggleVoice = () => {
    if (typeof window === 'undefined' || !voiceEnabled) return;
    type SpeechRecognitionLike = {
      continuous: boolean;
      interimResults: boolean;
      onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const win = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? '')
        .join('');
      setText(transcript);
      setVoiceError(false);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setVoiceError(true);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setVoiceError(false);
  };

  return (
    <div className={e.composer}>
      <div ref={liveRef} className={e.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {streaming ? t('ai.a11y.streaming') : listening ? t('ai.a11y.listening') : voiceError ? t('ai.a11y.voiceError') : ''}
      </div>
      {suggestions.length > 0 && (
        <div className={e.promptChips} role="group" aria-label={t('ai.chat.suggestions')}>
          {suggestions.map((s) => (
            <button key={s} type="button" className={e.promptChip} onClick={() => setText(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {attachments.length > 0 && (
        <p className={e.sectionHint} role="status">
          {t('ai.chat.attachments')}: {attachments.map((a) => a.name).join(', ')}
        </p>
      )}
      <div className={e.composerRow}>
        <button
          type="button"
          className={e.promptChip}
          onClick={() => attachmentsEnabled && fileRef.current?.click()}
          disabled={!attachmentsEnabled || disabled || loading || streaming}
          aria-label={t('ai.chat.attach')}
          title={attachmentsEnabled ? t('ai.chat.attach') : t('ai.subscription.attachmentsLocked')}
        >
          <Paperclip size={16} aria-hidden />
        </button>
        {voiceEnabled && (
          <button
            type="button"
            className={e.promptChip}
            onClick={toggleVoice}
            aria-label={t('ai.chat.voice')}
            aria-pressed={listening}
            disabled={disabled || loading || streaming}
          >
            {listening ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
          </button>
        )}
        <input ref={fileRef} type="file" hidden multiple onChange={(ev) => void onFiles(ev.target.files)} />
        <textarea
          className={e.textarea}
          value={text}
          rows={2}
          disabled={disabled || loading || streaming}
          placeholder={t('ai.chat.placeholder')}
          aria-label={t('ai.chat.placeholder')}
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              submit();
            }
          }}
        />
        {streaming ? (
          <AuthButton onClick={onStop} aria-label={t('ai.a11y.stopStreaming')} variant="secondary">
            <Square size={16} aria-hidden />
          </AuthButton>
        ) : (
          <AuthButton
            onClick={submit}
            loading={loading}
            loadingLabel={t('ai.a11y.sending')}
            disabled={disabled}
            aria-label={t('ai.chat.send')}
          >
            <Send size={16} aria-hidden />
          </AuthButton>
        )}
      </div>
    </div>
  );
}
