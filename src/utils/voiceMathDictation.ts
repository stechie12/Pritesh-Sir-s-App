export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0?: { transcript?: string; confidence?: number };
    };
  };
}

export interface SpeechRecognitionErrorEventLike {
  error?: string;
  message?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

export type SpeechRecognitionCtorLike = new () => SpeechRecognitionLike;

/**
 * Converts natural spoken mathematics phrases into clean mathematical expressions
 * while preserving normal conversational English sentences.
 */
export function normalizeSpokenMathTranscript(rawTranscript: string): string {
  if (!rawTranscript || !rawTranscript.trim()) return '';
  let text = rawTranscript.trim().replace(/\s+/g, ' ');

  // Normalize spoken word numbers only when adjacent to math operators or trig functions
  const wordDigits: Record<string, string> = {
    zero: '0',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
  };

  // Spoken trigonometric functions + angles
  text = text
    .replace(/\bcosecant\b/gi, 'cosec')
    .replace(/\bcotangent\b/gi, 'cot')
    .replace(/\bsecant\b/gi, 'sec')
    .replace(/\btangent\b/gi, 'tan')
    .replace(/\bcosine\b/gi, 'cos')
    .replace(/\bsine\b/gi, 'sin');

  // Spoken square/cube roots
  text = text
    .replace(/\bcube root of\s+([a-z0-9]+)/gi, 'cbrt($1)')
    .replace(/\bsquare root of\s+([a-z0-9]+)/gi, 'sqrt($1)')
    .replace(/\broot\s+(\d+)/gi, 'sqrt($1)');

  // Spoken powers / exponents
  text = text
    .replace(/\b([a-z0-9)]+)\s+squared\b/gi, '$1^2')
    .replace(/\b([a-z0-9)]+)\s+cubed\b/gi, '$1^3')
    .replace(/\b([a-z0-9)]+)\s+(?:to the power of|raised to the power of|raised to)\s+(-?[a-z0-9]+)/gi, '$1^$2');

  // Spoken Greek symbols & degrees
  text = text
    .replace(/\btheta\b/gi, 'θ')
    .replace(/\balpha\b/gi, 'α')
    .replace(/\bbeta\b/gi, 'β')
    .replace(/\bpi\b/gi, 'π')
    .replace(/(\d+(?:\.\d+)?)\s+degrees?\b/gi, '$1°');

  // Spoken arithmetic & comparison operators (only in mathematical contexts)
  text = text
    .replace(/\bis equal to\b/gi, '=')
    .replace(/\bequals\b/gi, '=')
    .replace(/\bplus or minus\b/gi, '±')
    .replace(/\bdivided by\b/gi, '/')
    .replace(/\bover\b(?=\s*[\d(a-z√])/gi, '/')
    .replace(/\bmultiplied by\b/gi, '×')
    .replace(/(\d|[a-z)])\s+times\s+(\d|[a-z(])/gi, '$1 × $2')
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\bless than or equal to\b/gi, '≤')
    .replace(/\bgreater than or equal to\b/gi, '≥');

  // Replace trailing "= zero" etc. with numeric digit
  text = text.replace(
    /([=+\-×/])\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
    (_m, op: string, word: string) => `${op} ${wordDigits[word.toLowerCase()] ?? word}`
  );

  // Clean up spacing around operators and symbols
  text = text
    .replace(/\s+([=+\-×/±≤≥])\s+/g, ' $1 ')
    .replace(/\s+°/g, '°')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Returns a student-friendly message for Web Speech API error codes.
 */
export function describeSpeechError(errorCode?: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Allow microphone access in your browser bar to dictate math problems.';
    case 'no-speech':
      return 'No speech detected. Speak clearly near your microphone or click the mic button to try again.';
    case 'audio-capture':
      return 'No microphone was found on this device. Connect a mic or type your question below.';
    case 'network':
      return 'Speech recognition network hiccup. Check your connection and tap the mic button again.';
    case 'aborted':
      return 'Voice dictation stopped.';
    default:
      return 'Voice dictation is unavailable in this browser frame. You can still type or use the Math Pad.';
  }
}

export interface VoiceDictationOptions {
  lang?: string;
  continuous?: boolean;
  mathMode?: boolean;
  autoSubmitDelayMs?: number;
  recognitionCtor?: SpeechRecognitionCtorLike | null;
  onListeningChange?: (listening: boolean) => void;
  onInterimChange?: (interimText: string) => void;
  onFinalTranscript?: (finalText: string) => void;
  onAutoSubmit?: (combinedText: string) => void;
  onError?: (friendlyMessage: string, rawCode?: string) => void;
}

export interface VoiceDictationController {
  isSupported: () => boolean;
  isActive: () => boolean;
  start: (initialText?: string) => boolean;
  stop: () => void;
  setMathMode: (enabled: boolean) => void;
  setAutoSubmitDelayMs: (delayMs: number) => void;
  setLang: (lang: string) => void;
}

export function getBrowserSpeechRecognitionCtor(): SpeechRecognitionCtorLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtorLike;
    webkitSpeechRecognition?: SpeechRecognitionCtorLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/**
 * Stateful Web Speech API controller supporting continuous hands-free math dictation,
 * real-time interim transcripts, spoken-math conversion, and silence-based auto-submit.
 */
export function createVoiceDictationController(
  options: VoiceDictationOptions = {}
): VoiceDictationController {
  let recognition: SpeechRecognitionLike | null = null;
  let active = false;
  let lang = options.lang || 'en-IN';
  let mathMode = options.mathMode ?? true;
  let autoSubmitDelayMs = options.autoSubmitDelayMs ?? 0;
  let accumulatedFinal = '';
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const resolveCtor = () =>
    options.recognitionCtor !== undefined
      ? options.recognitionCtor
      : getBrowserSpeechRecognitionCtor();

  const clearSilenceTimer = () => {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  const formatPiece = (piece: string) =>
    mathMode ? normalizeSpokenMathTranscript(piece) : piece.trim();

  const stop = () => {
    clearSilenceTimer();
    const instance = recognition;
    recognition = null;
    if (active) {
      active = false;
      options.onListeningChange?.(false);
    }
    options.onInterimChange?.('');
    if (instance) {
      try {
        instance.onend = null;
        instance.onerror = null;
        instance.onresult = null;
        instance.stop();
      } catch {
        // Ignore already-stopped recognition instance
      }
    }
  };

  const start = (initialText = ''): boolean => {
    const Ctor = resolveCtor();
    if (!Ctor) {
      options.onError?.(
        'Voice dictation requires a Web Speech API browser (Chrome, Edge, or Safari). Please type your problem or use the Math Pad.',
        'unsupported'
      );
      return false;
    }

    if (active) {
      stop();
    }

    accumulatedFinal = initialText.trim();
    clearSilenceTimer();

    try {
      const instance = new Ctor();
      instance.lang = lang;
      instance.continuous = options.continuous ?? true;
      instance.interimResults = true;
      instance.maxAlternatives = 1;
      recognition = instance;

      instance.onstart = () => {
        active = true;
        options.onListeningChange?.(true);
      };

      instance.onresult = (event: SpeechRecognitionEventLike) => {
        let interimRaw = '';
        let finalRaw = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res?.[0]?.transcript || '';
          if (res?.isFinal) {
            finalRaw += `${text} `;
          } else {
            interimRaw += `${text} `;
          }
        }

        const formattedInterim = formatPiece(interimRaw);
        options.onInterimChange?.(formattedInterim);

        if (finalRaw.trim()) {
          const formattedFinal = formatPiece(finalRaw);
          if (formattedFinal) {
            accumulatedFinal = accumulatedFinal
              ? `${accumulatedFinal} ${formattedFinal}`.trim()
              : formattedFinal;
            options.onFinalTranscript?.(accumulatedFinal);
            options.onInterimChange?.('');

            clearSilenceTimer();
            if (autoSubmitDelayMs > 0 && accumulatedFinal) {
              const snapshot = accumulatedFinal;
              silenceTimer = setTimeout(() => {
                if (active && snapshot) {
                  stop();
                  options.onAutoSubmit?.(snapshot);
                }
              }, autoSubmitDelayMs);
            }
          }
        }
      };

      instance.onerror = (ev: SpeechRecognitionErrorEventLike) => {
        const code = ev?.error;
        if (code === 'aborted') {
          stop();
          return;
        }
        options.onError?.(describeSpeechError(code), code);
        stop();
      };

      instance.onend = () => {
        clearSilenceTimer();
        recognition = null;
        if (active) {
          active = false;
          options.onListeningChange?.(false);
        }
        options.onInterimChange?.('');
      };

      instance.start();
      // Some environments fire onstart asynchronously; mark active immediately if start didn't throw
      if (!active) {
        active = true;
        options.onListeningChange?.(true);
      }
      return true;
    } catch {
      recognition = null;
      active = false;
      options.onListeningChange?.(false);
      options.onError?.(describeSpeechError('unknown'), 'unknown');
      return false;
    }
  };

  return {
    isSupported: () => Boolean(resolveCtor()),
    isActive: () => active,
    start,
    stop,
    setMathMode: (enabled: boolean) => {
      mathMode = enabled;
    },
    setAutoSubmitDelayMs: (delayMs: number) => {
      autoSubmitDelayMs = Math.max(0, delayMs);
    },
    setLang: (nextLang: string) => {
      lang = nextLang;
    },
  };
}
