/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PitchDetector } from "pitchy";
import { 
  Video, 
  Square, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Volume2, 
  MessageSquare,
  Sparkles,
  ChevronRight,
  Loader2,
  Lock,
  PlayCircle,
  Trophy,
  ArrowRight,
  BookOpen,
  Camera,
  Eye,
  Zap,
  User,
  Music,
  Mic,
  LayoutGrid,
  History,
  VolumeX,
  Headphones,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type Rating = 'Excelente' | 'Bom' | 'Regular' | 'Ruim';

interface AnalysisResult {
  finalRating: Rating;
  attentionDiagnosis: string;
  initialHookAnalysis?: string;
  facialExpressionAnalysis?: string;
  bodyLanguageAnalysis?: string;
  voiceEnergyAnalysis: string;
  technicalAnalysis: string; // Specific for singing or public speaking
  strengths: string[];
  improvements: string[];
  practicalCorrection: string;
  retentionVerdict?: string;
  isApproved: boolean;
}

type ObjectiveType = 'stories' | 'public' | 'singing';
type InputMode = 'video' | 'audio';

interface Exercise {
  id: string;
  title: string;
  description: string;
  objective: string;
  focus: string[];
}

const OBJECTIVES: Record<ObjectiveType, { title: string; description: string; icon: any; exercises: Exercise[] }> = {
  stories: {
    title: 'Stories & Reels',
    description: 'Melhore seu storytelling, dicção e retenção nos vídeos curtos.',
    icon: Video,
    exercises: [
      {
        id: 's1',
        title: 'Gancho de 3 Segundos',
        description: 'Abra o vídeo com uma frase que impeça o scroll imediato.',
        objective: 'Reter o usuário logo no início.',
        focus: ['Gancho', 'Energia', 'Expressão']
      },
      {
        id: 's2',
        title: 'Storytelling Dinâmico',
        description: 'Conte uma pequena história ou dica de forma rápida e envolvente.',
        objective: 'Manter a atenção durante toda a narrativa.',
        focus: ['Dicção', 'Ritmo', 'Entonação']
      },
      {
        id: 's3',
        title: 'CTA Irresistível',
        description: 'Finalize com uma chamada para ação clara e persuasiva.',
        objective: 'Converter a atenção em engajamento.',
        focus: ['Persuasão', 'Clareza', 'Presença']
      }
    ]
  },
  public: {
    title: 'Falar em Público',
    description: 'Treine oratória, conversação e presença para apresentações.',
    icon: MessageSquare,
    exercises: [
      {
        id: 'p1',
        title: 'Pitch de Elevador',
        description: 'Apresente uma ideia complexa em apenas 30 segundos.',
        objective: 'Sintetizar informações com autoridade.',
        focus: ['Autoridade', 'Postura', 'Concisão']
      },
      {
        id: 'p2',
        title: 'Discurso Inspirador',
        description: 'Fale sobre um propósito ou visão com emoção e clareza.',
        objective: 'Conectar emocionalmente com a audiência.',
        focus: ['Emoção', 'Pausas Dramáticas', 'Contato Visual']
      },
      {
        id: 'p3',
        title: 'Lidando com Objeções',
        description: 'Simule uma resposta a uma pergunta difícil ou crítica.',
        objective: 'Manter a calma e a clareza sob pressão.',
        focus: ['Raciocínio Rápido', 'Tom de Voz', 'Segurança']
      },
      {
        id: 'p4',
        title: 'Conversação 1-a-1',
        description: 'Simule uma conversa casual mas profissional com uma pessoa.',
        objective: 'Demonstrar empatia, escuta ativa e clareza.',
        focus: ['Empatia', 'Escuta Ativa', 'Naturalidade']
      }
    ]
  },
  singing: {
    title: 'Cantar',
    description: 'Melhore sua técnica vocal, afinação e performance artística.',
    icon: Music,
    exercises: [
      {
        id: 'c1',
        title: 'Aquecimento e Sustentação',
        description: 'Cante uma nota sustentada focando no controle da respiração.',
        objective: 'Melhorar o suporte respiratório.',
        focus: ['Respiração', 'Apoio', 'Estabilidade']
      },
      {
        id: 'c2',
        title: 'Dinâmica e Expressão',
        description: 'Cante um trecho variando entre suave e forte (crescendo/decrescendo).',
        objective: 'Dominar a dinâmica vocal.',
        focus: ['Dinâmica', 'Volume', 'Agilidade']
      },
      {
        id: 'c3',
        title: 'Performance Emocional',
        description: 'Interprete uma música focando na entrega sentimental da letra.',
        objective: 'Transmitir a mensagem da canção.',
        focus: ['Interpretação', 'Afinação', 'Expressividade']
      }
    ]
  }
};

// --- Components ---

// --- Components ---

const LiveCoach = ({ isOpen, onClose, initialContext, exerciseTitle, objectiveType }: { isOpen: boolean; onClose: () => void; initialContext?: AnalysisResult; exerciseTitle?: string; objectiveType?: ObjectiveType }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlaying = useRef(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const persona = objectiveType === 'singing' 
        ? 'um mentor vocal e artista performático super carismático, estilo jurado de show de talentos ou coach de canto de celebridades'
        : 'um mentor de oratória e comunicação magnética, estilo influenciador digital de alta performance e palestrante internacional';

      const systemInstruction = `Você é ${persona}. 
        Sua interação deve ser dinâmica, envolvente e encorajadora, exatamente como nos Stories e Reels: rápida, direta ao ponto e cheia de energia.
        
        SUA MISSÃO:
        1. Se o aluno estiver cantando, avalie afinação, emoção e técnica. Se ele estiver falando, avalie dicção, ganchos e presença.
        2. Seja expressivo! Se ele for bem, comemore como um fã. Se precisar corrigir, faça de forma construtiva e rápida.
        3. Observe a POSTURA, EXPRESSÃO FACIAL e CONTATO VISUAL do aluno em tempo real e dê feedback imediato.
        4. Fale de forma concisa. Use gírias profissionais leves se couber (ex: "solta a voz", "que presença!", "ajusta esse gancho").
        5. Responda sempre em Português.
        
        ${initialContext ? `
        CONTEXTO DA ANÁLISE ANTERIOR:
        - Diagnóstico: ${initialContext.attentionDiagnosis}
        - Pontos Fortes: ${initialContext.strengths.join(', ')}
        - Pontos de Melhoria: ${initialContext.improvements.join(', ')}
        ` : `
        O aluno está treinando: "${exerciseTitle || 'Comunicação Geral'}".
        `}
      `;

      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          }
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startMediaCapture();
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              const binary = atob(base64Audio);
              const pcm = new Int16Array(binary.length / 2);
              for (let i = 0; i < pcm.length; i++) {
                pcm[i] = (binary.charCodeAt(i * 2) & 0xFF) | (binary.charCodeAt(i * 2 + 1) << 8);
              }
              audioQueue.current.push(pcm);
              if (!isPlaying.current) playNextInQueue();
            }
            
            // Handle transcriptions if available (optional but good for UI)
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              setTranscript(message.serverContent.modelTurn.parts[0].text);
            }

            if (message.serverContent?.interrupted) {
              audioQueue.current = [];
              isPlaying.current = false;
            }
          },
          onclose: () => {
            stopMediaCapture();
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            onClose();
          }
        }
      });
      sessionRef.current = session;
    } catch (err) {
      console.error("Failed to connect to Live API:", err);
      setIsConnecting(false);
    }
  };

  const startMediaCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Audio Capture
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        if (sessionRef.current) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      // Video Frame Capture
      frameIntervalRef.current = window.setInterval(() => {
        captureAndSendFrame();
      }, 1000);

    } catch (err) {
      console.error("Error capturing media:", err);
    }
  };

  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !sessionRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = 320;
    const height = (video.videoHeight / video.videoWidth) * width;
    canvas.width = width;
    canvas.height = height;
    
    context.drawImage(video, 0, 0, width, height);
    const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    
    sessionRef.current.sendRealtimeInput({
      video: { data: base64Data, mimeType: 'image/jpeg' }
    });
  };

  const stopMediaCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.error("Error closing audioContextRef:", err));
      }
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  const playNextInQueue = () => {
    if (audioQueue.current.length === 0) {
      isPlaying.current = false;
      setIsSpeaking(false);
      return;
    }
    
    isPlaying.current = true;
    setIsSpeaking(true);
    const pcm = audioQueue.current.shift()!;
    const audioCtx = new AudioContext({ sampleRate: 24000 });
    const buffer = audioCtx.createBuffer(1, pcm.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) {
      channelData[i] = pcm[i] / 0x7FFF;
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.onended = () => {
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(err => console.error("Error closing AudioContext:", err));
      }
      playNextInQueue();
    };
    source.start();
  };

  useEffect(() => {
    if (isOpen) startSession();
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      stopMediaCapture();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          className="relative w-full h-full max-w-md bg-slate-900 flex flex-col shadow-2xl"
        >
          {/* Full Screen Video Background */}
          <div className="absolute inset-0 z-0">
            <video 
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover opacity-80"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
          </div>

          {/* Top Bar */}
          <div className="relative z-10 p-6 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 w-fit">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Live Mentorship</span>
              </div>
              <h2 className="text-white font-black text-lg drop-shadow-lg">
                {objectiveType === 'singing' ? 'Vocal Coach' : 'Mentor de Oratória'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-white/20 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Interaction Area */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="mb-8 relative">
              <div className={`w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center shadow-2xl transition-all duration-500 ${isSpeaking ? 'scale-110 ring-4 ring-white/20' : 'scale-100'}`}>
                {isSpeaking && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-indigo-600 animate-ping opacity-20" />
                    <div className="absolute -inset-4 rounded-full border-2 border-indigo-400/30 animate-pulse" />
                  </>
                )}
                {objectiveType === 'singing' ? <Music className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
              </div>
            </div>

            <div className="space-y-4 max-w-xs">
              <h3 className="text-2xl font-black text-white drop-shadow-xl tracking-tight">
                {isConnecting ? 'Chamando Mentor...' : isSpeaking ? 'Mentor Analisando...' : 'Pode falar, estou ouvindo!'}
              </h3>
              <p className="text-white/70 text-sm font-medium leading-relaxed drop-shadow-md">
                {isConnecting 
                  ? 'Conectando com seu mentor de performance...' 
                  : isSpeaking 
                    ? 'Ouça as dicas em tempo real sobre sua postura e voz.' 
                    : 'O mentor está te vendo. Comece a falar ou cantar para receber feedback.'}
              </p>
              
              {transcript && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10"
                >
                  <p className="text-white/80 text-[10px] font-medium italic">"{transcript}"</p>
                </motion.div>
              )}
            </div>

            {/* Visualizer (Fake but looks cool for Reels vibe) */}
            {isSpeaking && (
              <div className="mt-8 flex items-end gap-1 h-8">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [8, 32, 12, 24, 8] }}
                    transition={{ repeat: Infinity, duration: 0.5 + Math.random(), delay: i * 0.1 }}
                    className="w-1 bg-indigo-400 rounded-full"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="relative z-10 p-8 space-y-4">
            <div className="bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Dica do Mentor</p>
              <p className="text-white text-xs font-medium italic leading-relaxed">
                {objectiveType === 'singing' 
                  ? "Foque na respiração diafragmática e na projeção da voz." 
                  : "Mantenha o contato visual com a lente e use as mãos para enfatizar."}
              </p>
            </div>

            <button 
              onClick={onClose}
              className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 transition-all shadow-xl shadow-rose-900/20 flex items-center justify-center gap-3 active:scale-95"
            >
              <Square className="w-5 h-5 fill-current" />
              ENCERRAR MENTORIA
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const AnalysisSection = ({ title, content, icon: Icon, color = "indigo" }: { title: string; content: string; icon: any; color?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
  >
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-2 bg-${color}-50 rounded-lg`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
      </div>
      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{title}</h3>
    </div>
    <p className="text-slate-600 text-sm leading-relaxed">{content}</p>
  </motion.div>
);

interface HistoryItem extends AnalysisResult {
  id: string;
  date: string;
  exerciseTitle: string;
  objectiveTitle: string;
}

export default function App() {
  const [selectedObjective, setSelectedObjective] = useState<ObjectiveType | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('video');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [unlockedIndices, setUnlockedIndices] = useState<Record<ObjectiveType, number>>(() => {
    const saved = localStorage.getItem('vozmestra_unlocked');
    return saved ? JSON.parse(saved) : { stories: 0, public: 0, singing: 0 };
  });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('vozmestra_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [view, setView] = useState<'selection' | 'list' | 'exercise' | 'history' | 'improvement' | 'drill_practice'>('selection');
  
  // Script Generator State
  const [niche, setNiche] = useState('');
  const [contentIdea, setContentIdea] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Improvement Drills State
  const [improvementPoint, setImprovementPoint] = useState<string | null>(null);
  const [improvementDrills, setImprovementDrills] = useState<Exercise[]>([]);
  const [isGeneratingDrills, setIsGeneratingDrills] = useState(false);
  const [activeDrill, setActiveDrill] = useState<Exercise | null>(null);

  // Tuner State
  const [pitch, setPitch] = useState<{ note: string; octave: number; cents: number; frequency: number } | null>(null);
  const [isTuned, setIsTuned] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLiveCoachOpen, setIsLiveCoachOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentExercises = selectedObjective ? OBJECTIVES[selectedObjective].exercises : [];
  const currentExercise = currentExercises[currentExerciseIndex];
  const unlockedIndex = selectedObjective ? unlockedIndices[selectedObjective] : 0;

  useEffect(() => {
    localStorage.setItem('vozmestra_unlocked', JSON.stringify(unlockedIndices));
  }, [unlockedIndices]);

  useEffect(() => {
    localStorage.setItem('vozmestra_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startMedia = async () => {
    try {
      const constraints = {
        video: inputMode === 'video' ? { facingMode: 'user' } : false,
        audio: true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (inputMode === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // Start Tuner if singing
      if (selectedObjective === 'singing') {
        startTuner(stream);
      }

      return stream;
    } catch (err) {
      setError("Não foi possível acessar a câmera ou microfone. Verifique as permissões.");
      console.error(err);
      return null;
    }
  };

  const startTuner = (stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;

    const detector = PitchDetector.forFloat32Array(analyser.fftSize);
    const input = new Float32Array(detector.inputLength);
    const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    const updatePitch = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getFloatTimeDomainData(input);
      const [frequency, clarity] = detector.findPitch(input, audioContext.sampleRate);

      if (clarity > 0.8 && frequency > 50 && frequency < 2000) {
        const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        const roundedNote = Math.round(noteNum) + 69;
        const noteName = NOTE_NAMES[roundedNote % 12];
        const octave = Math.floor(roundedNote / 12) - 1;
        const cents = Math.floor((noteNum - Math.round(noteNum)) * 100);
        
        setPitch({ note: noteName, octave, cents, frequency });
        setIsTuned(Math.abs(cents) < 20);
      } else {
        setPitch(null);
        setIsTuned(false);
      }
      animationFrameRef.current = requestAnimationFrame(updatePitch);
    };

    updatePitch();
  };

  const stopTuner = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      // Don't close context to avoid issues with re-opening, just disconnect
      analyserRef.current?.disconnect();
      analyserRef.current = null;
    }
    setPitch(null);
    setIsTuned(false);
  };

  const startRecording = async () => {
    const stream = await startMedia();
    if (!stream) return;

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const mimeType = inputMode === 'video' ? 'video/webm' : 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setMediaBlob(blob);
      analyzeMedia(blob);
    };

    mediaRecorder.start();
    setIsRecording(true);
    setResult(null);
    setError(null);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      stopTuner();
      setIsRecording(false);
    }
  };

  const generateScript = async () => {
    if (!niche || !contentIdea) {
      setError("Por favor, preencha seu nicho e o que deseja transmitir.");
      return;
    }
    
    setIsGeneratingScript(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Você é um copywriter especialista em vídeos curtos (Reels/Stories).
      Crie um roteiro curto e persuasivo para o exercício: "${currentExercise.title}".
      
      NICHO: ${niche}
      O QUE QUER TRANSMITIR: ${contentIdea}
      FOCO DO EXERCÍCIO: ${currentExercise.focus.join(', ')}
      
      O roteiro deve ser direto, natural e focado em alta retenção. 
      Retorne APENAS o texto do roteiro, sem comentários adicionais.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }]
      });

      setGeneratedScript(response.text || '');
    } catch (err) {
      setError("Erro ao gerar roteiro. Tente novamente.");
      console.error(err);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const generateImprovementDrills = async (point: string) => {
    setImprovementPoint(point);
    setIsGeneratingDrills(true);
    setView('improvement');
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Você é um mentor especialista em ${selectedObjective === 'singing' ? 'técnica vocal' : 'comunicação'}.
      O aluno recebeu o seguinte ponto de melhoria: "${point}".
      
      Crie 3 exercícios práticos e rápidos (drills) para ele praticar agora e superar essa dificuldade.
      
      Retorne um JSON com um array de objetos seguindo esta estrutura:
      - id: string única
      - title: título curto do exercício
      - description: instrução clara de como fazer
      - objective: o que ele vai ganhar com isso
      - focus: array de 2-3 palavras-chave
      
      Retorne APENAS o JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                objective: { type: Type.STRING },
                focus: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "title", "description", "objective", "focus"]
            }
          }
        }
      });

      const drills = JSON.parse(response.text) as Exercise[];
      setImprovementDrills(drills);
    } catch (err) {
      setError("Erro ao gerar exercícios de melhoria. Tente novamente.");
      console.error(err);
    } finally {
      setIsGeneratingDrills(false);
    }
  };

  const analyzeMedia = async (blob: Blob) => {
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = inputMode === 'video' ? 'video/webm' : 'audio/webm';
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        
        const prompt = `Você é um mentor de comunicação estratégica especializado em ${selectedObjective === 'singing' ? 'técnica vocal e canto' : 'oratória e persuasão'}.
        Analise este ${inputMode === 'video' ? 'vídeo' : 'áudio'} para o exercício: "${currentExercise.title}".
        
        OBJETIVO DO ALUNO: ${OBJECTIVES[selectedObjective!].title}.
        MODALIDADE: ${inputMode === 'video' ? 'Vídeo (Expressão + Voz)' : 'Áudio (Apenas Voz)'}.
        
        Analise os seguintes pontos:
        ${inputMode === 'video' ? '1. EXPRESSÃO FACIAL E CORPORAL: Transmite a emoção/autoridade correta?' : ''}
        2. VOZ E ENERGIA: Dicção, tom, volume e clareza.
        3. TÉCNICA ESPECÍFICA: ${selectedObjective === 'singing' ? 'Afinação, sustentação e interpretação.' : 'Gancho, persuasão e storytelling.'}
        
        Classificação Final: Excelente, Bom, Regular, Ruim.
        Regra: Se for "Ruim", o usuário deve ser reprovado.
        
        Retorne um JSON com a seguinte estrutura:
        - finalRating: string (Excelente, Bom, Regular, Ruim)
        - attentionDiagnosis: string (Diagnóstico rápido do impacto)
        - facialExpressionAnalysis: string (Opcional, apenas se vídeo)
        - bodyLanguageAnalysis: string (Opcional, apenas se vídeo)
        - voiceEnergyAnalysis: string (Análise da voz)
        - technicalAnalysis: string (Análise técnica de ${selectedObjective})
        - strengths: array de strings
        - improvements: array de strings
        - practicalCorrection: string (Instrução direta e prática)
        - isApproved: boolean (true se não for Ruim)`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                },
                { text: prompt }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                finalRating: { type: Type.STRING, enum: ["Excelente", "Bom", "Regular", "Ruim"] },
                attentionDiagnosis: { type: Type.STRING },
                facialExpressionAnalysis: { type: Type.STRING },
                bodyLanguageAnalysis: { type: Type.STRING },
                voiceEnergyAnalysis: { type: Type.STRING },
                technicalAnalysis: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
                practicalCorrection: { type: Type.STRING },
                isApproved: { type: Type.BOOLEAN }
              },
              required: [
                "finalRating", "attentionDiagnosis", "voiceEnergyAnalysis", 
                "technicalAnalysis", "strengths", "improvements", 
                "practicalCorrection", "isApproved"
              ]
            }
          }
        });

        const data = JSON.parse(response.text) as AnalysisResult;
        setResult(data);
        setIsAnalyzing(false);

        // Speak feedback automatically
        speakFeedback(data);

        // Add to history
        const historyItem: HistoryItem = {
          ...data,
          id: Date.now().toString(),
          date: new Date().toLocaleString('pt-BR'),
          exerciseTitle: currentExercise.title,
          objectiveTitle: OBJECTIVES[selectedObjective!].title
        };
        setHistory(prev => [historyItem, ...prev].slice(0, 20)); // Keep last 20

        // Progression Logic
        if (data.isApproved && selectedObjective) {
          if (currentExerciseIndex === unlockedIndex && unlockedIndex < currentExercises.length - 1) {
            setUnlockedIndices(prev => ({
              ...prev,
              [selectedObjective]: prev[selectedObjective] + 1
            }));
          }
        }
      };
    } catch (err) {
      setError("Ocorreu um erro na análise. Tente novamente.");
      setIsAnalyzing(false);
      console.error(err);
    }
  };

  const speakFeedback = async (analysis: AnalysisResult) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Step 1: Generate the text to be spoken
      const persona = selectedObjective === 'singing' 
        ? 'um mentor vocal e artista performático super carismático'
        : 'um mentor de oratória e comunicação magnética estilo influenciador';

      const textPrompt = `Você é ${persona}. 
      Resuma os resultados do aluno de forma super dinâmica, envolvente e encorajadora, como se estivesse gravando um Story ou Reel de feedback.
      
      DIAGNÓSTICO: ${analysis.attentionDiagnosis}
      PONTOS FORTES: ${analysis.strengths.join(', ')}
      PONTOS DE MELHORIA: ${analysis.improvements.join(', ')}
      CORREÇÃO PRÁTICA: ${analysis.practicalCorrection}
      
      Escreva um texto curto (máximo 300 caracteres) para ser lido em voz alta, focando no que ele fez bem e no que deve focar agora para evoluir.
      Seja direto, use energia e termine com uma frase de impacto.
      Retorne APENAS o texto que deve ser falado.`;

      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: textPrompt }] }]
      });

      const speechText = textResponse.text || "";
      if (!speechText) throw new Error("Falha ao gerar texto de feedback");

      // Step 2: Convert text to speech
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say: ${speechText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      }
    } catch (err) {
      console.error("Erro ao gerar feedback em voz:", err);
    } finally {
      setIsSpeaking(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderObjectiveSelection = () => (
    <div className="space-y-8 py-10">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-900">Qual seu objetivo hoje?</h2>
        <p className="text-slate-500">Escolha uma trilha para começar seu treinamento.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {(Object.keys(OBJECTIVES) as ObjectiveType[]).map((key) => {
          const obj = OBJECTIVES[key];
          const Icon = obj.icon;
          return (
            <motion.div
              key={key}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedObjective(key);
                setCurrentExerciseIndex(0);
                setView('list');
              }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all text-left flex items-center gap-6 group cursor-pointer"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                <Icon className="w-8 h-8 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-800">{obj.title}</h3>
                  {unlockedIndices[key] > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-full">
                      {Math.round(((unlockedIndices[key]) / (obj.exercises.length - 1)) * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm mb-3">{obj.description}</p>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedObjective(key);
                    setIsLiveCoachOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all w-fit"
                >
                  <Sparkles className="w-3 h-3" /> Mentor IA Live
                </button>
              </div>
              <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </motion.div>
          );
        })}
      </div>

      {Object.values(unlockedIndices).some(v => (v as number) > 0) && (
        <div className="pt-10 flex flex-col items-center gap-4">
          <button 
            onClick={() => {
              if (window.confirm('Tem certeza que deseja reiniciar TODO o seu progresso em todas as trilhas?')) {
                setUnlockedIndices({ stories: 0, public: 0, singing: 0 });
                setCurrentExerciseIndex(0);
              }
            }}
            className="text-slate-400 text-xs font-bold hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-3 h-3" /> Reiniciar Todo o Progresso
          </button>
          
          {history.length > 0 && (
            <button 
              onClick={() => {
                if (window.confirm('Deseja limpar todo o histórico de treinos?')) {
                  setHistory([]);
                }
              }}
              className="text-slate-400 text-[10px] font-bold hover:text-rose-500 transition-colors flex items-center gap-2"
            >
              <History className="w-3 h-3" /> Limpar Histórico de Treinos
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderExerciseList = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button 
            onClick={() => setView('selection')}
            className="text-indigo-600 text-xs font-bold uppercase tracking-widest mb-1 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Mudar Objetivo
          </button>
          <h2 className="text-2xl font-black text-slate-800">{selectedObjective && OBJECTIVES[selectedObjective].title}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="bg-indigo-100 px-4 py-2 rounded-2xl">
            <span className="text-indigo-700 font-bold text-sm">{unlockedIndex + 1}/{currentExercises.length}</span>
          </div>
          {unlockedIndex > 0 && (
            <button 
              onClick={() => {
                if (window.confirm(`Deseja reiniciar seu progresso na trilha "${selectedObjective && OBJECTIVES[selectedObjective].title}"?`)) {
                  setUnlockedIndices(prev => ({ ...prev, [selectedObjective!]: 0 }));
                  setCurrentExerciseIndex(0);
                  setResult(null);
                  setMediaBlob(null);
                  setGeneratedScript('');
                }
              }}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Reiniciar Trilha
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {currentExercises.map((ex, idx) => {
          const isLocked = idx > unlockedIndex;
          const isCurrent = idx === currentExerciseIndex;
          const isCompleted = idx < unlockedIndex;

          return (
            <motion.button
              key={ex.id}
              whileHover={!isLocked ? { scale: 1.01 } : {}}
              whileTap={!isLocked ? { scale: 0.99 } : {}}
              onClick={() => {
                if (!isLocked) {
                  setCurrentExerciseIndex(idx);
                  setView('exercise');
                  setResult(null);
                  setGeneratedScript('');
                }
              }}
              className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${
                isLocked 
                  ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' 
                  : isCurrent 
                    ? 'bg-white border-indigo-200 shadow-md ring-2 ring-indigo-500/10'
                    : 'bg-white border-slate-100 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-4 text-left">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isLocked ? 'bg-slate-200' : isCompleted ? 'bg-emerald-100' : 'bg-indigo-100'
                }`}>
                  {isLocked ? (
                    <Lock className="w-6 h-6 text-slate-400" />
                  ) : isCompleted ? (
                    <Trophy className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <PlayCircle className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className={`font-bold ${isLocked ? 'text-slate-400' : 'text-slate-800'}`}>
                    {idx + 1}. {ex.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{ex.description}</p>
                </div>
              </div>
              {!isLocked && <ChevronRight className="w-5 h-5 text-slate-300" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  const renderExerciseView = () => (
    <div className="space-y-8">
      {/* Exercise Info */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => {
              setView('list');
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
              }
            }}
            className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline"
          >
            <RotateCcw className="w-4 h-4" /> Voltar
          </button>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsLiveCoachOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                <Sparkles className="w-3 h-3" /> Mentor IA
              </button>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setInputMode('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${inputMode === 'video' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <Video className="w-3 h-3" /> Vídeo
                </button>
                <button 
                  onClick={() => setInputMode('audio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${inputMode === 'audio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <Mic className="w-3 h-3" /> Áudio
                </button>
              </div>
            </div>
            {unlockedIndex > 0 && (
              <button 
                onClick={() => {
                  if (window.confirm(`Deseja reiniciar seu progresso na trilha "${selectedObjective && OBJECTIVES[selectedObjective].title}"?`)) {
                    setUnlockedIndices(prev => ({ ...prev, [selectedObjective!]: 0 }));
                    setCurrentExerciseIndex(0);
                    setResult(null);
                    setMediaBlob(null);
                    setGeneratedScript('');
                    setView('list');
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach(track => track.stop());
                    }
                  }
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reiniciar Trilha
              </button>
            )}
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-900 mb-2">{currentExercise.title}</h2>
        <p className="text-slate-600 mb-4">{currentExercise.description}</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {currentExercise.focus.map(f => (
            <span key={f} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full">
              {f}
            </span>
          ))}
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Objetivo do Exercício</h4>
          <p className="text-sm text-slate-700 font-medium">{currentExercise.objective}</p>
        </div>

        {/* Script Generator UI for Stories & Reels */}
        {selectedObjective === 'stories' && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seu Nicho</label>
                <input 
                  type="text" 
                  placeholder="Ex: Tráfego Pago, Nutrição..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O que quer transmitir?</label>
                <input 
                  type="text" 
                  placeholder="Ex: Dica rápida, Bom dia..."
                  value={contentIdea}
                  onChange={(e) => setContentIdea(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            
            <button 
              onClick={generateScript}
              disabled={isGeneratingScript}
              className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all disabled:opacity-50"
            >
              {isGeneratingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generatedScript ? 'Regerar Sugestão de Fala' : 'Gerar Sugestão de Fala'}
            </button>

            <AnimatePresence>
              {generatedScript && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-indigo-600 p-5 rounded-2xl text-white shadow-lg shadow-indigo-200 relative"
                >
                  <div className="absolute -top-2 left-6 px-2 bg-indigo-900 rounded text-[10px] font-bold uppercase tracking-widest">Sugestão de Fala</div>
                  <p className="text-sm font-medium leading-relaxed italic">"{generatedScript}"</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Media Preview / Recording */}
      <div className="flex flex-col items-center justify-center">
        <div className={`relative w-full max-w-sm ${inputMode === 'video' ? 'aspect-[9/16]' : 'h-48'} bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white flex items-center justify-center`}>
          {inputMode === 'video' ? (
            <video 
              ref={videoPreviewRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className={`p-6 rounded-full bg-indigo-500/20 ${isRecording ? 'animate-pulse' : ''}`}>
                <Mic className="w-12 h-12 text-indigo-400" />
              </div>
              <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Modo Áudio</span>
            </div>
          )}
          
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              <span className="text-white text-xs font-bold font-mono">{formatTime(recordingTime)}</span>
            </div>
          )}

          {/* Real-time Tuner Overlay for Singing */}
          {selectedObjective === 'singing' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-6">
              <div className={`bg-black/60 backdrop-blur-xl rounded-2xl p-4 border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                pitch ? (isTuned ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]') : 'border-white/10'
              }`}>
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Analisador de Tom</span>
                  {pitch && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isTuned ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {isTuned ? 'Afinado' : 'Fora do Tom'}
                    </span>
                  )}
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className={`text-5xl font-black transition-colors duration-300 ${
                    pitch ? (isTuned ? 'text-emerald-400' : 'text-rose-400') : 'text-white/20'
                  }`}>
                    {pitch ? pitch.note : '--'}
                  </span>
                  <span className="text-lg font-bold text-white/40">{pitch ? pitch.octave : ''}</span>
                </div>

                {pitch && (
                  <div className="w-full space-y-2">
                    <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ x: `${50 + (pitch.cents / 2)}%` }}
                        className={`absolute top-0 left-0 w-1 h-full rounded-full transition-colors ${isTuned ? 'bg-emerald-400' : 'bg-rose-400'}`}
                      />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-white/30" />
                    </div>
                    <div className="flex justify-between text-[8px] font-bold text-white/30 uppercase tracking-tighter">
                      <span>Bemol</span>
                      <span>{pitch.cents > 0 ? `+${pitch.cents}` : pitch.cents} cents</span>
                      <span>Sustenido</span>
                    </div>
                  </div>
                )}
                
                {!pitch && (
                  <p className="text-[10px] text-white/30 font-medium">Aguardando voz...</p>
                )}
              </div>
            </div>
          )}

          {!isRecording && !isAnalyzing && !result && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <button 
                onClick={startMedia}
                className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all"
              >
                {inputMode === 'video' ? <Camera className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8 text-center">
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
              <h3 className="text-xl font-bold mb-2">Analisando Performance</h3>
              <p className="text-slate-400 text-sm">Avaliando sua técnica e entrega...</p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isAnalyzing}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${
              isRecording 
                ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            } ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRecording ? (
              <Square className="text-white w-8 h-8 fill-current" />
            ) : (
              inputMode === 'video' ? <Video className="text-white w-10 h-10" /> : <Mic className="text-white w-10 h-10" />
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Final Rating & Diagnosis */}
          <div className={`rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden ${
            result.finalRating === 'Ruim' ? 'bg-rose-600 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'
          }`}>
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/80 text-sm font-bold uppercase tracking-wider">Nota Final: {result.finalRating}</span>
                <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold">
                  {result.isApproved ? 'APROVADO' : 'REPROVADO'}
                </div>
              </div>
              
              <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                <Sparkles className="w-8 h-8" />
                {result.attentionDiagnosis}
              </h2>
            </div>
          </div>

          {/* Detailed Analysis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputMode === 'video' && result.facialExpressionAnalysis && (
              <AnalysisSection title="Expressão Facial" content={result.facialExpressionAnalysis} icon={User} />
            )}
            {inputMode === 'video' && result.bodyLanguageAnalysis && (
              <AnalysisSection title="Linguagem Corporal" content={result.bodyLanguageAnalysis} icon={TrendingUp} />
            )}
            <AnalysisSection title="Voz e Energia" content={result.voiceEnergyAnalysis} icon={Volume2} />
            <AnalysisSection title={`Técnica: ${selectedObjective === 'singing' ? 'Canto' : 'Oratória'}`} content={result.technicalAnalysis} icon={Zap} color="amber" />
          </div>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
              <h3 className="text-emerald-800 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Pontos Fortes
              </h3>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-emerald-700 text-sm flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
              <h3 className="text-amber-800 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Onde melhorar
              </h3>
              <ul className="space-y-4">
                {result.improvements.map((s, i) => (
                  <li key={i} className="space-y-2">
                    <div className="text-amber-700 text-sm flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />
                      {s}
                    </div>
                    <button 
                      onClick={() => generateImprovementDrills(s)}
                      className="ml-3.5 mt-2 text-xs font-bold text-amber-700 bg-amber-200/50 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-all flex items-center gap-2 shadow-sm border border-amber-200/50"
                    >
                      <Sparkles className="w-3 h-3" /> Melhorar neste ponto
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Practical Correction */}
          <div className="bg-indigo-900 rounded-3xl p-8 text-white">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              Correção Prática
            </h3>
            <div className="bg-white/10 p-6 rounded-2xl border border-white/10 mb-8">
              <p className="text-indigo-100 leading-relaxed font-medium">
                {result.practicalCorrection}
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setIsLiveCoachOpen(true)}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
              >
                <Headphones className="w-5 h-5" />
                Conversar com Mentor (Voz)
              </button>

              <button 
                onClick={() => {
                  setResult(null);
                  setMediaBlob(null);
                  startMedia();
                }}
                className="w-full py-4 bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/10"
              >
                <RotateCcw className="w-5 h-5" />
                Repetir Exercício
              </button>

              <button 
                onClick={() => {
                  if (window.confirm(`Deseja reiniciar seu progresso na trilha "${selectedObjective && OBJECTIVES[selectedObjective].title}"?`)) {
                    setUnlockedIndices(prev => ({ ...prev, [selectedObjective!]: 0 }));
                    setCurrentExerciseIndex(0);
                    setResult(null);
                    setMediaBlob(null);
                    setGeneratedScript('');
                    setView('list');
                  }
                }}
                className="w-full py-3 bg-transparent text-white/60 font-bold text-xs flex items-center justify-center gap-2 hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar Trilha Completa
              </button>

              {result.isApproved && currentExerciseIndex < currentExercises.length - 1 && (
                <button 
                  onClick={() => {
                    setCurrentExerciseIndex(prev => prev + 1);
                    setResult(null);
                    setMediaBlob(null);
                    startMedia();
                  }}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                >
                  Próximo Exercício
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button 
            onClick={() => setView('selection')}
            className="text-indigo-600 text-xs font-bold uppercase tracking-widest mb-1 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Voltar
          </button>
          <h2 className="text-2xl font-black text-slate-800">Histórico de Treinos</h2>
        </div>
        <button 
          onClick={() => {
            if (window.confirm('Deseja limpar todo o histórico?')) {
              setHistory([]);
            }
          }}
          className="text-rose-600 text-xs font-bold hover:underline"
        >
          Limpar Tudo
        </button>
      </div>

      {history.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
            <History className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500">Você ainda não realizou nenhum treino.</p>
          <button 
            onClick={() => setView('selection')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm"
          >
            Começar Agora
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.date}</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  item.finalRating === 'Ruim' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {item.finalRating}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{item.exerciseTitle}</h3>
                <p className="text-xs text-slate-500">{item.objectiveTitle}</p>
              </div>
              <p className="text-sm text-slate-600 italic">"{item.attentionDiagnosis}"</p>
              <div className="pt-2 border-t border-slate-50">
                <button 
                  onClick={() => {
                    setResult(item);
                    // Find objective and exercise index to allow re-trying
                    const objKey = (Object.keys(OBJECTIVES) as ObjectiveType[]).find(k => OBJECTIVES[k].title === item.objectiveTitle);
                    if (objKey) {
                      setSelectedObjective(objKey);
                      const exIdx = OBJECTIVES[objKey].exercises.findIndex(e => e.title === item.exerciseTitle);
                      if (exIdx !== -1) setCurrentExerciseIndex(exIdx);
                    }
                    setView('exercise');
                  }}
                  className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1"
                >
                  Ver Detalhes <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderImprovementView = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setView('exercise')}
          className="text-indigo-600 text-xs font-bold uppercase tracking-widest hover:underline flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Voltar para Análise
        </button>
      </div>

      <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <TrendingUp className="w-32 h-32" />
        </div>
        <div className="relative z-10 space-y-2">
          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Sessão de Reforço</h4>
          <h2 className="text-3xl font-black leading-tight">Superando Desafios</h2>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 mt-4">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-slate-200">Foco: <span className="text-white italic">"{improvementPoint}"</span></p>
          </div>
        </div>
      </div>

      {isGeneratingDrills ? (
        <div className="py-24 flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-bold text-slate-800">Criando seu Plano de Ação</p>
            <p className="text-slate-500 max-w-xs mx-auto">Nossa IA está desenhando exercícios específicos para sua evolução.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Exercícios Recomendados</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {improvementDrills.map((drill, idx) => (
              <motion.div
                key={drill.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all"
              >
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors">
                    <span className="text-indigo-600 font-black text-xl group-hover:text-white transition-colors">{idx + 1}</span>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{drill.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{drill.description}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {drill.focus.map(f => (
                        <span key={f} className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">
                          {f}
                        </span>
                      ))}
                    </div>

                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/30">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Objetivo</p>
                      <p className="text-xs text-indigo-700 font-bold leading-tight">{drill.objective}</p>
                    </div>

                    <button 
                      onClick={() => {
                        setActiveDrill(drill);
                        setView('drill_practice');
                        startMedia();
                      }}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Praticar este Drill
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="pt-10 border-t border-slate-100">
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex flex-col sm:flex-row items-center gap-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                <Trophy className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="font-bold text-emerald-900">Pronto para o próximo nível?</h4>
                <p className="text-sm text-emerald-700">Após praticar os drills, tente gravar o exercício original novamente para ver sua evolução.</p>
              </div>
              <button 
                onClick={() => {
                  setView('exercise');
                  setResult(null);
                  setMediaBlob(null);
                  startMedia();
                }}
                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 whitespace-nowrap"
              >
                Gravar Original
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDrillPracticeView = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => {
            setView('improvement');
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
          }}
          className="text-indigo-600 text-xs font-bold uppercase tracking-widest hover:underline flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Voltar para Lista
        </button>
      </div>

      {activeDrill && (
        <>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Praticando Drill</h4>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{activeDrill.title}</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">{activeDrill.description}</p>
            <div className="flex flex-wrap gap-2">
              {activeDrill.focus.map(f => (
                <span key={f} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full uppercase">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className={`relative w-full max-w-sm ${inputMode === 'video' ? 'aspect-[9/16]' : 'h-48'} bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white flex items-center justify-center`}>
              {inputMode === 'video' ? (
                <video 
                  ref={videoPreviewRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className={`p-6 rounded-full bg-indigo-500/20 ${isRecording ? 'animate-pulse' : ''}`}>
                    <Mic className="w-12 h-12 text-indigo-400" />
                  </div>
                  <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Modo Áudio</span>
                </div>
              )}
              
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-white text-xs font-bold font-mono">{formatTime(recordingTime)}</span>
                </div>
              )}

              {/* Real-time Tuner Overlay for Singing Drills */}
              {selectedObjective === 'singing' && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-6">
                  <div className={`bg-black/60 backdrop-blur-xl rounded-2xl p-4 border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                    pitch ? (isTuned ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]') : 'border-white/10'
                  }`}>
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Analisador de Tom</span>
                      {pitch && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isTuned ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {isTuned ? 'Afinado' : 'Fora do Tom'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-black transition-colors duration-300 ${
                        pitch ? (isTuned ? 'text-emerald-400' : 'text-rose-400') : 'text-white/20'
                      }`}>
                        {pitch ? pitch.note : '--'}
                      </span>
                      <span className="text-lg font-bold text-white/40">{pitch ? pitch.octave : ''}</span>
                    </div>

                    {pitch && (
                      <div className="w-full space-y-2">
                        <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            animate={{ x: `${50 + (pitch.cents / 2)}%` }}
                            className={`absolute top-0 left-0 w-1 h-full rounded-full transition-colors ${isTuned ? 'bg-emerald-400' : 'bg-rose-400'}`}
                          />
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-white/30" />
                        </div>
                        <div className="flex justify-between text-[8px] font-bold text-white/30 uppercase tracking-tighter">
                          <span>Bemol</span>
                          <span>{pitch.cents > 0 ? `+${pitch.cents}` : pitch.cents} cents</span>
                          <span>Sustenido</span>
                        </div>
                      </div>
                    )}
                    
                    {!pitch && (
                      <p className="text-[10px] text-white/30 font-medium">Aguardando voz...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${
                  isRecording 
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {isRecording ? (
                  <Square className="text-white w-8 h-8 fill-current" />
                ) : (
                  inputMode === 'video' ? <Video className="text-white w-10 h-10" /> : <Mic className="text-white w-10 h-10" />
                )}
              </button>
              
              {!isRecording && mediaBlob && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-slate-500 text-sm font-medium">Drill concluído! Como você se sentiu?</p>
                  <button 
                    onClick={() => {
                      setView('improvement');
                      setMediaBlob(null);
                    }}
                    className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    Concluir Prática
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('selection')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">VozMestra</h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedObjective && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-600">{unlockedIndex + 1}/{currentExercises.length}</span>
              </div>
            )}
            <button 
              onClick={() => setView('history')}
              className={`p-2 rounded-lg transition-colors ${view === 'history' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'}`}
              title="Histórico"
            >
              <History className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setView('selection')}
              className={`p-2 rounded-lg transition-colors ${view === 'selection' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-600'}`}
              title="Objetivos"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-8">
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-3 text-rose-700 mb-8"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {view === 'selection' ? renderObjectiveSelection() : 
         view === 'list' ? renderExerciseList() : 
         view === 'history' ? renderHistory() :
         view === 'improvement' ? renderImprovementView() :
         view === 'drill_practice' ? renderDrillPracticeView() :
         renderExerciseView()}
      </main>
      {/* Hidden Audio for TTS */}
      <audio ref={audioRef} hidden />

      {/* Live Coach Modal */}
      <LiveCoach 
        isOpen={isLiveCoachOpen} 
        onClose={() => setIsLiveCoachOpen(false)} 
        initialContext={result || undefined} 
        exerciseTitle={currentExercise?.title}
        objectiveType={selectedObjective || undefined}
      />
    </div>
  );
}
