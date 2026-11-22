import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Mic, Play, Square, Volume2 } from 'lucide-react';
import type { GradeLevel } from '../utils/adaptiveEngine';
import { generateMentalSprintQuestion } from '../utils/studySuiteEngine';
import { normalizeSpokenMathTranscript } from '../utils/voiceMathDictation';
import type { WorkspacePreferences } from '../utils/workspacePreferences';

const MATH_SYMBOLS = [
  { sym: 'θ', name: 'Theta', spoken: 'Theta — standard symbol for an unknown plane angle in trigonometry.' },
  { sym: 'φ', name: 'Phi', spoken: 'Phi — often used for a second angle or the Golden Ratio 1.618.' },
  { sym: 'Σ', name: 'Sigma', spoken: 'Capital Sigma — summation operator adding a sequence of terms.' },
  { sym: 'Δ', name: 'Delta', spoken: 'Capital Delta — denotes change in a quantity, or quadratic discriminant b squared minus 4 a c.' },
  { sym: 'π', name: 'Pi', spoken: 'Pi — ratio of a circle circumference to diameter, approximately 3.14159.' },
  { sym: '∫', name: 'Integral', spoken: 'Integral sign — continuous summation representing signed area under a curve.' },
  { sym: '∞', name: 'Infinity', spoken: 'Infinity — unbounded growth beyond any finite real number.' },
  { sym: '∝', name: 'Proportional', spoken: 'Directly proportional to — indicates constant ratio between two variables.' },
  { sym: '≡', name: 'Identically Equal', spoken: 'Identically equal — true for all admissible values of the variable, as in trigonometric identities.' },
];

const CHAPTER_AUDIO_BRIEFINGS: Array<{ chapter: string; script: string }> = [
  {
    chapter: 'Trigonometrical Identities (3-Min Recap)',
    script:
      'Start every trigonometric proof by rewriting tan, cot, sec, and cosec in terms of sine and cosine. Keep the three Pythagorean identities handy: sine squared plus cosine squared equals one, one plus tan squared equals sec squared, and one plus cot squared equals cosec squared.',
  },
  {
    chapter: 'Quadratic Equations & Discriminant',
    script:
      'For a x squared plus b x plus c equals zero, compute the discriminant Delta equals b squared minus 4 a c. If Delta is positive you get two distinct real roots; if Delta equals zero the roots are real and equal; if Delta is negative the roots are non-real complex conjugates.',
  },
  {
    chapter: 'Mensuration — Cones, Cylinders & Spheres',
    script:
      'Always convert diameter to radius first. A cone has one third the volume of a cylinder with the same base radius and height. Remember slant height l equals the square root of r squared plus h squared for curved surface area pi r l.',
  },
];

interface VoiceAudioStudioProps {
  grade: GradeLevel;
  prefs: WorkspacePreferences;
  onUpdatePrefs: (patch: Partial<WorkspacePreferences>) => void;
}

export const VoiceAudioStudio: React.FC<VoiceAudioStudioProps> = ({
  grade,
  prefs,
  onUpdatePrefs,
}) => {
  // #43 Oral Rapid-Fire Quiz
  const [oralSeed, setOralSeed] = useState(5);
  const [oralAnswer, setOralAnswer] = useState('');
  const [oralStatus, setOralStatus] = useState<string | null>(null);
  const oralQuestion = generateMentalSprintQuestion(oralSeed);

  // #48 Spoken Math Preview Sandbox
  const [rawSpoken, setRawSpoken] = useState('x squared plus 3 x minus 10 equals 0');

  // #50 Web Audio Focus Soundscape
  const [soundscape, setSoundscape] = useState<'off' | 'rain' | 'brown' | 'library'>('off');
  const [soundVol, setSoundVol] = useState<number>(0.25);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = prefs.ttsRate;
    u.lang = prefs.ttsAccent;
    window.speechSynthesis.speak(u);
  };

  const stopSoundscape = () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      gainNodeRef.current = null;
    }
    setSoundscape('off');
  };

  const startSoundscape = (mode: 'rain' | 'brown' | 'library') => {
    stopSoundscape();
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (mode === 'brown') {
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 2.5;
        } else if (mode === 'rain') {
          data[i] = (lastOut + 0.08 * white) / 1.08;
          lastOut = data[i];
        } else {
          data[i] = (lastOut + 0.01 * white) / 1.01;
          lastOut = data[i];
          data[i] *= 1.8;
        }
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = mode === 'rain' ? 1400 : mode === 'brown' ? 420 : 650;

      const gain = ctx.createGain();
      gain.gain.value = soundVol * 0.25;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      audioCtxRef.current = ctx;
      gainNodeRef.current = gain;
      setSoundscape(mode);
    } catch {
      setSoundscape('off');
    }
  };

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = soundVol * 0.25;
    }
  }, [soundVol]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-4 text-xs">
      {/* #44, #45, #47 TTS Speed, Accent & Push-to-Talk */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
        <div className="font-semibold text-sm text-slate-900 dark:text-white">
          #44 / #45 / #47 Voice Narration & Push-to-Talk Controls
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            Narration Speed: <span className="font-mono font-semibold">{prefs.ttsRate.toFixed(2)}×</span>
            <input
              type="range"
              min={0.75}
              max={1.5}
              step={0.05}
              value={prefs.ttsRate}
              onChange={(e) => onUpdatePrefs({ ttsRate: Number(e.target.value) })}
              className="w-full mt-1"
            />
          </label>
          <label className="block">
            Voice Accent Profile:
            <select
              value={prefs.ttsAccent}
              onChange={(e) => onUpdatePrefs({ ttsAccent: e.target.value as WorkspacePreferences['ttsAccent'] })}
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="en-IN">Indian English (en-IN)</option>
              <option value="en-GB">British English (en-GB)</option>
              <option value="en-US">US Neutral (en-US)</option>
            </select>
          </label>
          <div className="flex flex-col justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.pushToTalkEnabled}
                onChange={(e) => onUpdatePrefs({ pushToTalkEnabled: e.target.checked })}
              />
              <span>#47 Enable Spacebar Push-to-Talk</span>
            </label>
            <button
              type="button"
              onClick={() => speakText(`Hello! Pritesh Sir's Maths Tutor ready for Standard ${grade} at ${prefs.ttsRate} times speed.`)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Test Voice</span>
            </button>
          </div>
        </div>
      </div>

      {/* #43 Hands-Free Oral Rapid-Fire Quiz & #48 Spoken Math Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
          <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-sky-500" />
            <span>#43 Oral Rapid-Fire Math Quiz</span>
          </div>
          <div className="text-lg font-mono font-bold text-slate-900 dark:text-white">{oralQuestion.prompt}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => speakText(`What is ${oralQuestion.prompt.replace('= ?', '')}`)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Read Question Aloud</span>
            </button>
            <input
              type="number"
              value={oralAnswer}
              onChange={(e) => setOralAnswer(e.target.value)}
              placeholder="Your answer"
              className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                const ok = Number(oralAnswer) === oralQuestion.answer;
                const msg = ok ? 'Correct! Next question ready.' : `Answer is ${oralQuestion.answer}.`;
                setOralStatus(msg);
                speakText(msg);
                setOralAnswer('');
                setOralSeed((s) => s + 11);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
            >
              Submit
            </button>
          </div>
          {oralStatus && <div className="text-sky-600 dark:text-sky-400 font-medium">{oralStatus}</div>}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
          <div className="font-semibold text-sm text-slate-900 dark:text-white">#48 Spoken Math Preview Converter</div>
          <input
            type="text"
            value={rawSpoken}
            onChange={(e) => setRawSpoken(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
          <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 font-mono text-sm text-sky-700 dark:text-sky-300">
            Normalized Math: {normalizeSpokenMathTranscript(rawSpoken)}
          </div>
        </div>
      </div>

      {/* #46 Podcast Chapter Summaries & #50 Ambient Focus Soundscapes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-2.5">
          <div className="font-semibold text-sm text-slate-900 dark:text-white">#46 Podcast-Style Chapter Audio Summaries</div>
          {CHAPTER_AUDIO_BRIEFINGS.map((b) => (
            <div key={b.chapter} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2.5">
              <span className="font-medium">{b.chapter}</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => speakText(b.script)} className="px-2.5 py-1 rounded bg-sky-600 text-white font-medium">
                  Play
                </button>
                <button type="button" onClick={() => window.speechSynthesis?.cancel()} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700">
                  Stop
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
          <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            <Headphones className="w-4 h-4 text-emerald-500" />
            <span>#50 Ambient Focus Soundscapes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['rain', 'brown', 'library'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => (soundscape === mode ? stopSoundscape() : startSoundscape(mode))}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium ${
                  soundscape === mode ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {soundscape === mode ? `Playing: ${mode}` : mode}
              </button>
            ))}
            {soundscape !== 'off' && (
              <button type="button" onClick={stopSoundscape} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 text-white">
                <Square className="w-3 h-3" />
                <span>Mute</span>
              </button>
            )}
          </div>
          <label className="block">
            Ambience Volume: {Math.round(soundVol * 100)}%
            <input type="range" min={0.05} max={1} step={0.05} value={soundVol} onChange={(e) => setSoundVol(Number(e.target.value))} className="w-full" />
          </label>
        </div>
      </div>

      {/* #49 Math Symbol Pronunciation Tutor */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-2.5">
        <div className="font-semibold text-sm text-slate-900 dark:text-white">#49 Math Symbol Pronunciation Tutor</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {MATH_SYMBOLS.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => speakText(s.spoken)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-left hover:border-sky-500/60 transition-colors"
            >
              <div className="text-lg font-serif font-bold text-sky-600 dark:text-sky-400">{s.sym}</div>
              <div className="font-semibold text-slate-900 dark:text-white">{s.name}</div>
              <div className="text-[10px] text-slate-500">Tap to hear</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
