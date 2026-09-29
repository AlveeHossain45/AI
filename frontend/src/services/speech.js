/**
 * Voice support via the browser Web Speech API (no API key required).
 * STT: SpeechRecognition · TTS: speechSynthesis
 * Gracefully reports unavailability so the UI can hide/disable controls.
 */

const getRecognition = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SpeechRecognition ? new SpeechRecognition() : null;
};

export const speechToTextSupported = () =>
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
export const textToSpeechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Start microphone dictation.
 * @returns {{stop: () => void} | null} null when unsupported
 */
export function startDictation ({ onResult, onEnd, onError, lang = navigator.language || 'en-US', interim = true } = {}) {
  const recognition = getRecognition();
  if (!recognition) return null;

  recognition.lang = lang;
  recognition.interimResults = interim;
  recognition.continuous = true;

  let finalText = '';
  recognition.onresult = (event) => {
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += `${transcript} `;
      else interimText += transcript;
    }
    onResult?.(`${finalText}${interimText}`.trim(), Boolean(interimText));
  };
  recognition.onerror = (event) => onError?.(event.error || 'speech-error');
  recognition.onend = () => onEnd?.(finalText.trim());

  try {
    recognition.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try { recognition.stop(); } catch { /* already stopped */ }
    },
    abort: () => {
      try { recognition.abort(); } catch { /* already stopped */ }
    },
  };
}

/** Read text aloud. Returns a stop() function. */
export function speak (text, { lang = navigator.language || 'en-US', rate = 1, pitch = 1 } = {}) {
  if (!textToSpeechSupported()) return null;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 5000));
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return () => window.speechSynthesis.cancel();
}

export const stopSpeaking = () => {
  if (textToSpeechSupported()) window.speechSynthesis.cancel();
};

export default { startDictation, speak, stopSpeaking, speechToTextSupported, textToSpeechSupported };
