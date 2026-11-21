export type TranslatorLangCode =
  | 'pa-IN'
  | 'en-US'
  | 'ur-PK'
  | 'hi-IN'
  | 'ar-SA'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'tr-TR'
  | 'ru-RU'
  | 'zh-CN'
  | 'ja-JP'
  | 'ko-KR';

export interface TranslatorLanguageDef {
  code: TranslatorLangCode;
  apiCode: string;
  shortTag: string;
  label: string;
  nativeName: string;
}

export const TRANSLATOR_LANGUAGES: TranslatorLanguageDef[] = [
  { code: 'pa-IN', apiCode: 'pa', shortTag: 'PA', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'en-US', apiCode: 'en', shortTag: 'EN', label: 'English', nativeName: 'English' },
  { code: 'ur-PK', apiCode: 'ur', shortTag: 'UR', label: 'Urdu', nativeName: 'اردو' },
  { code: 'hi-IN', apiCode: 'hi', shortTag: 'HI', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ar-SA', apiCode: 'ar', shortTag: 'AR', label: 'Arabic', nativeName: 'العربية' },
  { code: 'es-ES', apiCode: 'es', shortTag: 'ES', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr-FR', apiCode: 'fr', shortTag: 'FR', label: 'French', nativeName: 'Français' },
  { code: 'de-DE', apiCode: 'de', shortTag: 'DE', label: 'German', nativeName: 'Deutsch' },
  { code: 'tr-TR', apiCode: 'tr', shortTag: 'TR', label: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ru-RU', apiCode: 'ru', shortTag: 'RU', label: 'Russian', nativeName: 'Русский' },
  { code: 'zh-CN', apiCode: 'zh-CN', shortTag: 'ZH', label: 'Chinese', nativeName: '中文' },
  { code: 'ja-JP', apiCode: 'ja', shortTag: 'JA', label: 'Japanese', nativeName: '日本語' },
  { code: 'ko-KR', apiCode: 'ko', shortTag: 'KO', label: 'Korean', nativeName: '한국어' },
];

export function getTranslatorLanguage(code: string): TranslatorLanguageDef {
  return (
    TRANSLATOR_LANGUAGES.find((l) => l.code === code) || TRANSLATOR_LANGUAGES[1]
  );
}

// Small bounded translation cache to eliminate duplicate network latency
const translationCache = new Map<string, string>();

function setCachedTranslation(key: string, value: string) {
  if (translationCache.size >= 250) {
    const oldest = translationCache.keys().next().value;
    if (oldest) translationCache.delete(oldest);
  }
  translationCache.set(key, value);
}

/**
 * Translates spoken phrases in real time between any pair of the 13 supported languages.
 * Uses low-latency CORS translation endpoints so Live Stream dubbing works without backend keys.
 */
export async function translateLiveText(
  text: string,
  sourceLang: TranslatorLangCode,
  targetLang: TranslatorLangCode
): Promise<string> {
  const cleaned = text.trim();
  if (!cleaned) return '';
  if (sourceLang === targetLang) return cleaned;

  const srcDef = getTranslatorLanguage(sourceLang);
  const tgtDef = getTranslatorLanguage(targetLang);
  const cacheKey = `${srcDef.apiCode}|${tgtDef.apiCode}|${cleaned.toLowerCase()}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  // Primary: fast Google Translate public endpoint
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3200);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      srcDef.apiCode
    )}&tl=${encodeURIComponent(tgtDef.apiCode)}&dt=t&q=${encodeURIComponent(cleaned)}`;
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as unknown[];
      if (Array.isArray(json) && Array.isArray(json[0])) {
        const segments = (json[0] as unknown[])
          .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
          .join('')
          .trim();
        if (segments) {
          setCachedTranslation(cacheKey, segments);
          return segments;
        }
      }
    }
  } catch {
    // fall through to secondary translation endpoint
  }

  // Secondary: MyMemory public translation API
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      cleaned
    )}&langpair=${encodeURIComponent(`${srcDef.apiCode}|${tgtDef.apiCode}`)}`;
    const res = await fetch(mmUrl, { signal: controller.signal });
    window.clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        responseData?: { translatedText?: string };
      };
      const translated = data?.responseData?.translatedText?.trim();
      if (translated && !translated.toUpperCase().includes('MYMEMORY WARNING')) {
        setCachedTranslation(cacheKey, translated);
        return translated;
      }
    }
  } catch {
    // ignore network failure and return original phrase safely
  }

  return cleaned;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: {
    length: number;
    [idx: number]: {
      isFinal: boolean;
      0: { transcript: string; confidence?: number };
    };
  };
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createSpeechRecognitionInstance(
  lang: TranslatorLangCode
): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

export function speakTranslatedVoice(
  text: string,
  targetLang: TranslatorLangCode,
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const clean = text.trim();
  if (!clean) return;

  const synth = window.speechSynthesis;
  try {
    // Prevent backlog buildup if several live sentences arrive fast
    if (synth.speaking && synth.pending) {
      synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = targetLang;
    utterance.rate = options?.rate ?? 1.04;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = synth.getVoices();
    if (voices.length > 0) {
      const exactLower = targetLang.toLowerCase();
      const shortPrefix = exactLower.split('-')[0];
      const matchedVoice =
        voices.find((v) => v.lang.toLowerCase() === exactLower) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(shortPrefix));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }

    utterance.onstart = () => options?.onStart?.();
    utterance.onend = () => options?.onEnd?.();
    utterance.onerror = () => options?.onEnd?.();

    synth.speak(utterance);
  } catch {
    options?.onEnd?.();
  }
}

export function stopTranslatedVoice(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}
