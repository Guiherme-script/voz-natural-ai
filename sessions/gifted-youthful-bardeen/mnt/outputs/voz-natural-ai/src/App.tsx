import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  Play,
  History,
  Trash2,
  Loader2,
  ChevronDown,
  Download,
  Square,
  X,
  FileText,
  Mic,
  Zap,
  StopCircle,
} from 'lucide-react';
import {
  generateSpeech,
  generateSpeechElevenLabs,
  cloneVoice,
  type VoiceName,
  type ClonedVoice,
} from './lib/gemini';
import { playPCMAudio, playMP3Audio, pcmToWav, mp3ToBlob } from './lib/audioUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AudioHistoryItem {
  id: string;
  text: string;
  voice: string;
  voiceType: 'gemini' | 'elevenlabs';
  emotion: string;
  timestamp: number;
  base64: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice definitions
// ─────────────────────────────────────────────────────────────────────────────
const VOICES: { name: VoiceName; label: string; gender: string; description: string }[] = [
  { name: 'Charon',       label: 'Charon',       gender: 'M', description: 'Profundo, Poderoso — ideal para narrações' },
  { name: 'Fenrir',       label: 'Fenrir',       gender: 'M', description: 'Robusto, Maduro' },
  { name: 'Puck',         label: 'Puck',         gender: 'M', description: 'Jovem, Enérgico' },
  { name: 'Orus',         label: 'Orus',         gender: 'M', description: 'Grave, Imponente' },
  { name: 'Schedar',      label: 'Schedar',      gender: 'M', description: 'Neutro, Profissional' },
  { name: 'Rasalgethi',   label: 'Rasalgethi',   gender: 'M', description: 'Claro, Articulado' },
  { name: 'Achird',       label: 'Achird',       gender: 'M', description: 'Suave, Amigável' },
  { name: 'Algenib',      label: 'Algenib',      gender: 'M', description: 'Dinâmico, Expressivo' },
  { name: 'Kore',         label: 'Kore',         gender: 'F', description: 'Jovem, Clara' },
  { name: 'Zephyr',       label: 'Zephyr',       gender: 'F', description: 'Suave, Etérea' },
  { name: 'Aoede',        label: 'Aoede',        gender: 'F', description: 'Melodiosa, Cálida' },
  { name: 'Leda',         label: 'Leda',         gender: 'F', description: 'Elegante, Sofisticada' },
  { name: 'Sulafat',      label: 'Sulafat',      gender: 'F', description: 'Serena, Equilibrada' },
  { name: 'Vindemiatrix', label: 'Vindemiatrix', gender: 'F', description: 'Rica, Expressiva' },
];

const EMOTIONS = [
  { value: 'neutral',    label: '😐 Neutro' },
  { value: 'cheerful',   label: '😊 Alegre' },
  { value: 'excited',    label: '🤩 Animado' },
  { value: 'calm',       label: '😌 Calmo' },
  { value: 'sad',        label: '😢 Triste' },
  { value: 'angry',      label: '😠 Bravo' },
  { value: 'whispering', label: '🤫 Sussurro' },
  { value: 'dramatic',   label: '🎭 Dramático' },
  { value: 'serious',    label: '🧊 Sério' },
  { value: 'sarcastic',  label: '😏 Sarcástico' },
];

const VOICE_SAMPLE_TEXT = 'Olá! Esta é uma amostra da minha voz. Espero que goste do resultado!';

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY       = 'voz-natural-history';
const CLONED_VOICES_KEY = 'voz-natural-cloned-voices';
const MAX_HISTORY       = 30;

function loadHistory(): AudioHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items: AudioHistoryItem[] = raw ? JSON.parse(raw) : [];
    return items.map(i => ({ voiceType: 'gemini' as const, ...i }));
  } catch { return []; }
}

function saveHistory(items: AudioHistoryItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); } catch { /* quota */ }
}

function loadClonedVoices(): ClonedVoice[] {
  try {
    const raw = localStorage.getItem(CLONED_VOICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveClonedVoices(voices: ClonedVoice[]) {
  try { localStorage.setItem(CLONED_VOICES_KEY, JSON.stringify(voices)); } catch { /* quota */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [text, setText]         = useState('');
  const [voice, setVoice]       = useState<string>('Charon');
  const [emotion, setEmotion]   = useState('neutral');
  const [speed, setSpeed]       = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory]   = useState<AudioHistoryItem[]>(loadHistory);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Clone panel state
  const [clonedVoices, setClonedVoices]     = useState<ClonedVoice[]>(loadClonedVoices);
  const [cloneAudioFile, setCloneAudioFile] = useState<File | null>(null);
  const [cloneName, setCloneName]           = useState('');
  const [isCloning, setIsCloning]           = useState(false);
  const [cloneError, setCloneError]         = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess]     = useState<string | null>(null);
  const [clonePanelOpen, setClonePanelOpen] = useState(false);

  // Refs
  const stopPlaybackRef  = useRef<(() => void) | null>(null);
  const abortGenerateRef = useRef<AbortController | null>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const audioInputRef    = useRef<HTMLInputElement>(null);

  useEffect(() => { saveHistory(history); },          [history]);
  useEffect(() => { saveClonedVoices(clonedVoices); }, [clonedVoices]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isClonedVoice = (v: string) => clonedVoices.some(cv => cv.id === v);

  const stopPlayback = () => {
    stopPlaybackRef.current?.();
    stopPlaybackRef.current = null;
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!text.trim() || isLoading) return;
    stopPlayback();

    const abort = new AbortController();
    abortGenerateRef.current = abort;
    setIsLoading(true);
    setError(null);

    try {
      let base64: string;
      let voiceType: 'gemini' | 'elevenlabs';

      if (isClonedVoice(voice)) {
        base64    = await generateSpeechElevenLabs({ text, voiceId: voice, signal: abort.signal });
        voiceType = 'elevenlabs';
      } else {
        base64    = await generateSpeech({ text, voice: voice as VoiceName, emotion, signal: abort.signal });
        voiceType = 'gemini';
      }

      const voiceLabel = clonedVoices.find(v => v.id === voice)?.name ?? voice;
      const newItem: AudioHistoryItem = {
        id: crypto.randomUUID(),
        text: text.length > 80 ? text.substring(0, 80) + '…' : text,
        voice: voiceLabel,
        voiceType,
        emotion,
        timestamp: Date.now(),
        base64,
      };

      setHistory(prev => [newItem, ...prev]);
      await handlePlay(newItem.id, base64, voiceType);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message ?? 'Erro ao gerar áudio. Verifique a conexão.');
    } finally {
      setIsLoading(false);
      abortGenerateRef.current = null;
    }
  };

  const handleCancelGenerate = () => {
    abortGenerateRef.current?.abort();
    abortGenerateRef.current = null;
    setIsLoading(false);
  };

  // ── Playback ──────────────────────────────────────────────────────────────
  const handlePlay = async (id: string, base64: string, voiceType: 'gemini' | 'elevenlabs' = 'gemini') => {
    stopPlayback();
    setPlayingId(id);
    try {
      let handle;
      if (voiceType === 'elevenlabs') {
        handle = await playMP3Audio(base64, speed);
      } else {
        handle = playPCMAudio(base64, { playbackRate: speed });
      }
      stopPlaybackRef.current = () => { handle.stop(); setPlayingId(null); };
      await handle.promise;
    } finally {
      stopPlaybackRef.current = null;
      setPlayingId(null);
    }
  };

  const handleStop = () => stopPlayback();

  // ── Voice preview ─────────────────────────────────────────────────────────
  const handlePreviewVoice = async () => {
    if (isPreviewing || isClonedVoice(voice)) return;
    setIsPreviewing(true);
    stopPlayback();
    try {
      const base64 = await generateSpeech({ text: VOICE_SAMPLE_TEXT, voice: voice as VoiceName, emotion: 'neutral' });
      const handle = playPCMAudio(base64, { playbackRate: speed });
      stopPlaybackRef.current = () => { handle.stop(); };
      await handle.promise;
    } catch (err: any) {
      setError(err.message ?? 'Erro ao testar voz.');
    } finally {
      stopPlaybackRef.current = null;
      setIsPreviewing(false);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = (item: AudioHistoryItem) => {
    const blob = item.voiceType === 'elevenlabs' ? mp3ToBlob(item.base64) : pcmToWav(item.base64);
    const ext  = item.voiceType === 'elevenlabs' ? 'mp3' : 'wav';
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `voz-natural-${item.voice}-${item.id.substring(0, 6)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── File upload (text) ────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string).substring(0, 5000));
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // ── Voice cloning ─────────────────────────────────────────────────────────
  const MAX_AUDIO_MB = 30;

  const handleCloneVoice = async () => {
    if (!cloneAudioFile || !cloneName.trim() || isCloning) return;

    // Validate file size before sending
    const fileMB = cloneAudioFile.size / (1024 * 1024);
    if (fileMB > MAX_AUDIO_MB) {
      setCloneError(`Arquivo muito grande (${fileMB.toFixed(1)} MB). O limite é ${MAX_AUDIO_MB} MB. Use um arquivo MP3 comprimido ou corte o áudio.`);
      return;
    }

    setIsCloning(true);
    setCloneError(null);
    setCloneSuccess(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve((e.target?.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(cloneAudioFile);
      });
      const cloned = await cloneVoice({ name: cloneName.trim(), audioBase64: base64, audioMime: cloneAudioFile.type || 'audio/mpeg' });
      setClonedVoices(prev => [cloned, ...prev]);
      setVoice(cloned.id);
      setCloneSuccess(`Voz "${cloned.name}" clonada com sucesso!`);
      setCloneAudioFile(null);
      setCloneName('');
      if (audioInputRef.current) audioInputRef.current.value = '';
    } catch (err: any) {
      setCloneError(err.message ?? 'Falha ao clonar a voz.');
    } finally {
      setIsCloning(false);
    }
  };

  const deleteClonedVoice = (id: string) => {
    setClonedVoices(prev => prev.filter(v => v.id !== id));
    if (voice === id) setVoice('Charon');
  };

  // ── History ───────────────────────────────────────────────────────────────
  const clearHistory = () => setHistory([]);
  const deleteItem   = (id: string) => setHistory(prev => prev.filter(i => i.id !== id));

  // ── UI ────────────────────────────────────────────────────────────────────
  const voiceInfo  = VOICES.find(v => v.name === voice);
  const charLimit  = 5000;
  const charPct    = Math.min((text.length / charLimit) * 100, 100);
  const speedLabel = speed === 1.0 ? '1.0×' : `${speed.toFixed(1)}×`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30">
      <div className="atmosphere" />

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)]">
            <Volume2 size={18} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-[0.3em] uppercase opacity-80">Voz Natural AI</span>
        </div>
        <div className="text-[10px] opacity-20 font-mono">
          {history.length} / {MAX_HISTORY} no histórico
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* ── Main Panel ─────────────────────────────────────────────── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 text-sm text-red-300 flex items-center justify-between gap-4"
                >
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100 transition-opacity text-lg leading-none">×</button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="glass-panel rounded-3xl p-8 space-y-6">

              {/* Textarea */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Seu Texto</label>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono transition-colors ${text.length > charLimit * 0.9 ? 'text-red-400/70' : 'opacity-20'}`}>
                      {text.length} / {charLimit}
                    </span>

                    {/* Upload .txt */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Carregar arquivo .txt"
                      className="flex items-center gap-1 text-[10px] opacity-30 hover:opacity-80 hover:text-blue-400 transition-all"
                    >
                      <FileText size={12} />
                      <span className="hidden sm:inline">Carregar .txt</span>
                    </button>
                    <input ref={fileInputRef} type="file" accept=".txt,text/plain" onChange={handleFileUpload} className="hidden" />

                    {/* Clear text */}
                    {text.length > 0 && (
                      <button onClick={() => setText('')} title="Limpar texto" className="opacity-30 hover:opacity-80 hover:text-red-400 transition-all">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={charLimit}
                  placeholder="Comece a escrever sua jornada..."
                  className="w-full h-56 bg-transparent border-none outline-none text-lg font-serif font-light leading-relaxed placeholder:opacity-10 resize-none"
                />

                <div className="h-px w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500/50 transition-all duration-300" style={{ width: `${charPct}%` }} />
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-white/5">

                {/* Voice picker */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Voz</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={voice}
                        onChange={(e) => setVoice(e.target.value)}
                        className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500/50 transition-all cursor-pointer text-sm"
                      >
                        {clonedVoices.length > 0 && (
                          <optgroup label="── Voz Clonada ──" className="bg-[#0a0c10]">
                            {clonedVoices.map(cv => (
                              <option key={cv.id} value={cv.id} className="bg-[#0a0c10]">🎤 {cv.name}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="── Masculinas ──" className="bg-[#0a0c10]">
                          {VOICES.filter(v => v.gender === 'M').map(v => (
                            <option key={v.name} value={v.name} className="bg-[#0a0c10]">{v.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="── Femininas ──" className="bg-[#0a0c10]">
                          {VOICES.filter(v => v.gender === 'F').map(v => (
                            <option key={v.name} value={v.name} className="bg-[#0a0c10]">{v.label}</option>
                          ))}
                        </optgroup>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" size={16} />
                    </div>

                    {/* Preview button */}
                    {!isClonedVoice(voice) && (
                      <button
                        onClick={handlePreviewVoice}
                        disabled={isPreviewing || isLoading}
                        title="Testar voz"
                        className={`flex items-center gap-1 px-3 py-3 rounded-xl border text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
                          isPreviewing
                            ? 'border-blue-500/30 text-blue-400/60 cursor-not-allowed'
                            : 'border-white/10 hover:border-blue-500/40 hover:text-blue-400 opacity-50 hover:opacity-100'
                        }`}
                      >
                        {isPreviewing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                        <span>{isPreviewing ? '…' : 'Testar'}</span>
                      </button>
                    )}
                  </div>
                  {voiceInfo && <p className="text-[10px] opacity-30 px-1">{voiceInfo.description}</p>}
                  {isClonedVoice(voice) && <p className="text-[10px] text-blue-400/50 px-1">Voz clonada via ElevenLabs</p>}
                </div>

                {/* Emotion + Speed */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">
                      Tom Emocional
                      {isClonedVoice(voice) && <span className="ml-1 opacity-50">(n/a)</span>}
                    </label>
                    <div className="relative">
                      <select
                        value={emotion}
                        onChange={(e) => setEmotion(e.target.value)}
                        disabled={isClonedVoice(voice)}
                        className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500/50 transition-all cursor-pointer text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {EMOTIONS.map(e => (
                          <option key={e.value} value={e.value} className="bg-[#0a0c10]">{e.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Speed slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                      <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Velocidade</label>
                      <span className="text-[10px] font-mono text-blue-400/60">{speedLabel}</span>
                    </div>
                    <input
                      type="range" min="0.5" max="2.0" step="0.1" value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                      className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between px-0.5">
                      <span className="text-[9px] opacity-20">0.5×</span>
                      <span className="text-[9px] opacity-20">1.0×</span>
                      <span className="text-[9px] opacity-20">2.0×</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Generate / Cancel button */}
            <button
              onClick={isLoading ? handleCancelGenerate : handleGenerate}
              disabled={!isLoading && !text.trim()}
              className={`w-full py-5 rounded-2xl text-xs font-bold tracking-[0.3em] uppercase transition-all ${
                isLoading
                  ? 'bg-red-600/80 text-white hover:bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
                  : !text.trim()
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
              }`}
            >
              <span className="flex items-center justify-center gap-3">
                {isLoading ? (
                  <><StopCircle size={16} /> Cancelar Geração</>
                ) : (
                  <><Play size={14} fill="currentColor" /> Gerar Narração</>
                )}
              </span>
            </button>

            {/* ── Clone Voice Panel ─────────────────────────────────────── */}
            <div className="glass-panel rounded-3xl overflow-hidden">
              <button
                onClick={() => setClonePanelOpen(p => !p)}
                className="w-full flex items-center justify-between px-8 py-5 text-left"
              >
                <div className="flex items-center gap-3">
                  <Mic size={15} className="text-blue-400/60" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-50">
                    Clonar Voz — ElevenLabs
                  </span>
                  {clonedVoices.length > 0 && (
                    <span className="text-[9px] bg-blue-500/20 text-blue-400/80 px-2 py-0.5 rounded-full">
                      {clonedVoices.length}
                    </span>
                  )}
                </div>
                <ChevronDown size={14} className={`opacity-30 transition-transform duration-300 ${clonePanelOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {clonePanelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-8 pb-8 space-y-5 border-t border-white/5 pt-6">
                      <p className="text-[10px] opacity-30 leading-relaxed">
                        Envie um áudio de referência (MP3 ou WAV, máx. 30 MB — mínimo 30s para melhor qualidade).
                        Prefira MP3 para arquivos menores. Requer <span className="text-blue-400/60">ELEVENLABS_API_KEY</span> no <code className="bg-white/5 px-1 rounded">.env.local</code>.
                      </p>

                      <AnimatePresence>
                        {cloneError && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-300 flex items-center justify-between">
                            <span>{cloneError}</span>
                            <button onClick={() => setCloneError(null)}>×</button>
                          </motion.div>
                        )}
                        {cloneSuccess && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-xs text-green-300 flex items-center justify-between">
                            <span>{cloneSuccess}</span>
                            <button onClick={() => setCloneSuccess(null)}>×</button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Nome da voz</label>
                          <input
                            type="text" value={cloneName} onChange={(e) => setCloneName(e.target.value)}
                            placeholder="Ex: Minha Voz" maxLength={50}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 transition-all text-sm placeholder:opacity-20"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Arquivo de referência</label>
                          <button
                            onClick={() => audioInputRef.current?.click()}
                            className={`w-full flex items-center gap-2 bg-white/5 border rounded-xl px-4 py-3 text-sm transition-all ${
                              cloneAudioFile ? 'border-blue-500/40 text-blue-400/80' : 'border-white/10 opacity-50 hover:opacity-80'
                            }`}
                          >
                            <FileText size={14} />
                            <span className="truncate">
                              {cloneAudioFile
                                ? `${cloneAudioFile.name} (${(cloneAudioFile.size / (1024 * 1024)).toFixed(1)} MB)`
                                : 'Selecionar MP3 / WAV'}
                            </span>
                          </button>
                          <input ref={audioInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg"
                            onChange={(e) => setCloneAudioFile(e.target.files?.[0] ?? null)} className="hidden" />
                        </div>
                      </div>

                      <button
                        onClick={handleCloneVoice}
                        disabled={!cloneAudioFile || !cloneName.trim() || isCloning}
                        className={`w-full py-3.5 rounded-xl text-xs font-bold tracking-[0.2em] uppercase transition-all ${
                          !cloneAudioFile || !cloneName.trim() || isCloning
                            ? 'bg-white/5 text-white/20 cursor-not-allowed'
                            : 'bg-blue-600/70 text-white hover:bg-blue-500/80'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          {isCloning ? <><Loader2 size={13} className="animate-spin" /> Clonando…</> : <><Mic size={13} /> Clonar Voz</>}
                        </span>
                      </button>

                      {/* Saved cloned voices */}
                      {clonedVoices.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-30">Vozes salvas</label>
                          {clonedVoices.map(cv => (
                            <div
                              key={cv.id}
                              onClick={() => setVoice(cv.id)}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                                voice === cv.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/5 hover:border-white/15'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Mic size={12} className="text-blue-400/60" />
                                <span className="text-sm">{cv.name}</span>
                                {voice === cv.id && <span className="text-[9px] text-blue-400/60 font-bold tracking-widest uppercase">ativa</span>}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteClonedVoice(cv.id); }}
                                className="opacity-20 hover:opacity-80 hover:text-red-400 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── History Sidebar ─────────────────────────────────────────── */}
          <div className="lg:col-span-4 space-y-5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 flex items-center gap-2">
                <History size={12} /> Histórico
              </h3>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-[10px] opacity-20 hover:opacity-80 hover:text-red-400 transition-all">
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="space-y-3 custom-scrollbar max-h-[680px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {history.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-16 border border-white/5 rounded-3xl opacity-20">
                    <p className="text-[10px] font-bold tracking-[0.1em] uppercase">Vazio</p>
                    <p className="text-[9px] mt-1 opacity-60">Gere uma narração para começar</p>
                  </motion.div>
                ) : (
                  history.map((item) => {
                    const isItemPlaying = playingId === item.id;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                        className={`glass-panel rounded-2xl p-4 group transition-all ${isItemPlaying ? 'border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : ''}`}
                      >
                        {isItemPlaying && (
                          <div className="flex gap-[3px] mb-3 items-end h-4">
                            {[1, 2, 3, 4, 5].map(i => (
                              <motion.div key={i} className="w-1 bg-blue-400 rounded-full"
                                animate={{ height: ['4px', `${8 + i * 3}px`, '4px'] }}
                                transition={{ repeat: Infinity, duration: 0.6 + i * 0.1, ease: 'easeInOut' }}
                              />
                            ))}
                            <span className="text-[9px] text-blue-400/70 font-bold ml-2 tracking-widest uppercase self-center">tocando</span>
                          </div>
                        )}

                        <p className="text-sm font-serif italic text-white/55 line-clamp-2 mb-3">"{item.text}"</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold tracking-widest uppercase text-blue-400/60">
                              {item.voiceType === 'elevenlabs' ? '🎤 ' : ''}{item.voice}
                            </span>
                            {item.voiceType === 'gemini' && (
                              <>
                                <span className="text-[9px] opacity-20">·</span>
                                <span className="text-[9px] opacity-30 capitalize">{item.emotion}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isItemPlaying ? (
                              <button onClick={handleStop} className="p-2 hover:text-orange-400 transition-colors" title="Parar">
                                <Square size={12} fill="currentColor" />
                              </button>
                            ) : (
                              <button onClick={() => handlePlay(item.id, item.base64, item.voiceType)}
                                className="p-2 hover:text-blue-400 transition-colors" title="Reproduzir">
                                <Play size={13} fill="currentColor" />
                              </button>
                            )}
                            <button onClick={() => handleDownload(item)} className="p-2 hover:text-blue-400 transition-colors"
                              title={item.voiceType === 'elevenlabs' ? 'Baixar MP3' : 'Baixar WAV'}>
                              <Download size={13} />
                            </button>
                            <button onClick={() => deleteItem(item.id)} className="p-2 hover:text-red-400 transition-colors" title="Apagar">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </main>

      <footer className="py-16 text-center border-t border-white/5">
        <p className="text-[10px] font-bold tracking-[0.5em] uppercase opacity-20">
          Voz Natural AI · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
