import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  Play,
  Pause,
  History,
  Trash2,
  Loader2,
  ChevronDown,
  Download,
  Square,
} from 'lucide-react';
import { generateSpeech, VoiceName } from './lib/gemini';
import { playPCMAudio, pcmToWav } from './lib/audioUtils';

interface AudioHistoryItem {
  id: string;
  text: string;
  voice: VoiceName;
  emotion: string;
  timestamp: number;
  base64: string;
}

const VOICES: { name: VoiceName; label: string; gender: string; description: string }[] = [
  // ── Masculinas ──────────────────────────────────────────────────
  { name: 'Charon',      label: 'Charon',      gender: 'M', description: 'Profundo, Poderoso — ideal para narrações' },
  { name: 'Fenrir',      label: 'Fenrir',      gender: 'M', description: 'Robusto, Maduro' },
  { name: 'Puck',        label: 'Puck',        gender: 'M', description: 'Jovem, Enérgico' },
  { name: 'Orus',        label: 'Orus',        gender: 'M', description: 'Grave, Imponente' },
  { name: 'Schedar',     label: 'Schedar',     gender: 'M', description: 'Neutro, Profissional' },
  { name: 'Rasalgethi',  label: 'Rasalgethi',  gender: 'M', description: 'Claro, Articulado' },
  { name: 'Achird',      label: 'Achird',      gender: 'M', description: 'Suave, Amigável' },
  { name: 'Algenib',     label: 'Algenib',     gender: 'M', description: 'Dinâmico, Expressivo' },
  // ── Femininas ───────────────────────────────────────────────────
  { name: 'Kore',        label: 'Kore',        gender: 'F', description: 'Jovem, Clara' },
  { name: 'Zephyr',      label: 'Zephyr',      gender: 'F', description: 'Suave, Etérea' },
  { name: 'Aoede',       label: 'Aoede',       gender: 'F', description: 'Melodiosa, Cálida' },
  { name: 'Leda',        label: 'Leda',        gender: 'F', description: 'Elegante, Sofisticada' },
  { name: 'Sulafat',     label: 'Sulafat',     gender: 'F', description: 'Serena, Equilibrada' },
  { name: 'Vindemiatrix',label: 'Vindemiatrix',gender: 'F', description: 'Rica, Expressiva' },
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
];

const STORAGE_KEY = 'voz-natural-history';
const MAX_HISTORY = 30;

function loadHistory(): AudioHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: AudioHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // ignore quota errors
  }
}

export default function App() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<VoiceName>('Charon');
  const [emotion, setEmotion] = useState('neutral');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<AudioHistoryItem[]>(loadHistory);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  // Persist history to localStorage on every change
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const handleGenerate = async () => {
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const base64 = await generateSpeech({ text, voice, emotion });

      const newItem: AudioHistoryItem = {
        id: crypto.randomUUID(),
        text: text.length > 80 ? text.substring(0, 80) + '…' : text,
        voice,
        emotion,
        timestamp: Date.now(),
        base64,
      };

      setHistory(prev => [newItem, ...prev]);
      await handlePlay(newItem.id, base64);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Erro ao gerar áudio. Verifique a conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async (id: string, base64: string) => {
    // Stop current playback if any
    stopRef.current?.();

    setPlayingId(id);
    let stopped = false;

    stopRef.current = () => {
      stopped = true;
      setPlayingId(null);
    };

    try {
      await playPCMAudio(base64);
    } finally {
      if (!stopped) setPlayingId(null);
    }
  };

  const handleStop = () => {
    stopRef.current?.();
    stopRef.current = null;
  };

  const handleDownload = (base64: string, item: AudioHistoryItem) => {
    const blob = pcmToWav(base64);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voz-natural-${item.voice}-${item.id.substring(0, 6)}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => setHistory([]);
  const deleteItem = (id: string) => setHistory(prev => prev.filter(i => i.id !== id));

  const voiceInfo = VOICES.find(v => v.name === voice);
  const charLimit = 5000;
  const charPct = Math.min((text.length / charLimit) * 100, 100);

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

          {/* ── Main Panel ─────────────────────────────────────── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
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
                  <span className={`text-[10px] font-mono transition-colors ${text.length > charLimit * 0.9 ? 'text-red-400/70' : 'opacity-20'}`}>
                    {text.length} / {charLimit}
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={charLimit}
                  placeholder="Comece a escrever sua jornada..."
                  className="w-full h-56 bg-transparent border-none outline-none text-lg font-serif font-light leading-relaxed placeholder:opacity-10 resize-none"
                />
                {/* Char progress bar */}
                <div className="h-px w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500/50 transition-all duration-300"
                    style={{ width: `${charPct}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-white/5">
                {/* Voice picker */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Voz</label>
                  <div className="relative">
                    <select
                      value={voice}
                      onChange={(e) => setVoice(e.target.value as VoiceName)}
                      className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500/50 transition-all cursor-pointer text-sm"
                    >
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
                  {voiceInfo && (
                    <p className="text-[10px] opacity-30 px-1">{voiceInfo.description}</p>
                  )}
                </div>

                {/* Emotion picker */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Tom Emocional</label>
                  <div className="relative">
                    <select
                      value={emotion}
                      onChange={(e) => setEmotion(e.target.value)}
                      className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500/50 transition-all cursor-pointer text-sm"
                    >
                      {EMOTIONS.map(e => (
                        <option key={e.value} value={e.value} className="bg-[#0a0c10]">{e.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !text.trim()}
              className={`w-full py-5 rounded-2xl text-xs font-bold tracking-[0.3em] uppercase transition-all ${
                isLoading || !text.trim()
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
              }`}
            >
              <span className="flex items-center justify-center gap-3">
                {isLoading ? (
                  <><Loader2 className="animate-spin" size={16} /> Gerando áudio…</>
                ) : (
                  <><Play size={14} fill="currentColor" /> Gerar Narração</>
                )}
              </span>
            </button>
          </div>

          {/* ── History Sidebar ─────────────────────────────────── */}
          <div className="lg:col-span-4 space-y-5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 flex items-center gap-2">
                <History size={12} /> Histórico
              </h3>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-[10px] opacity-20 hover:opacity-80 hover:text-red-400 transition-all"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="space-y-3 custom-scrollbar max-h-[580px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {history.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 border border-white/5 rounded-3xl opacity-20"
                  >
                    <p className="text-[10px] font-bold tracking-[0.1em] uppercase">Vazio</p>
                    <p className="text-[9px] mt-1 opacity-60">Gere uma narração para começar</p>
                  </motion.div>
                ) : (
                  history.map((item) => {
                    const isItemPlaying = playingId === item.id;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`glass-panel rounded-2xl p-4 group transition-all ${isItemPlaying ? 'border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : ''}`}
                      >
                        {isItemPlaying && (
                          <div className="flex gap-[3px] mb-3 items-end h-4">
                            {[1, 2, 3, 4, 5].map(i => (
                              <motion.div
                                key={i}
                                className="w-1 bg-blue-400 rounded-full"
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
                            <span className="text-[9px] font-bold tracking-widest uppercase text-blue-400/60">{item.voice}</span>
                            <span className="text-[9px] opacity-20">·</span>
                            <span className="text-[9px] opacity-30 capitalize">{item.emotion}</span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isItemPlaying ? (
                              <button
                                onClick={handleStop}
                                className="p-2 hover:text-orange-400 transition-colors"
                                title="Parar"
                              >
                                <Square size={12} fill="currentColor" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePlay(item.id, item.base64)}
                                className="p-2 hover:text-blue-400 transition-colors"
                                title="Reproduzir"
                              >
                                <Play size={13} fill="currentColor" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDownload(item.base64, item)}
                              className="p-2 hover:text-blue-400 transition-colors"
                              title="Baixar WAV"
                            >
                              <Download size={13} />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-2 hover:text-red-400 transition-colors"
                              title="Apagar"
                            >
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
