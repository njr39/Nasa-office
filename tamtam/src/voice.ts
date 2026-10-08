import { lang } from './spec';

let ac: AudioContext | null = null;

export function unlockAudio() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac ||= new Ctor();
    void ac.resume();
  } catch { /* audio is optional */ }
}

export function sfx(freq: number, dur = 0.12, type: OscillatorType = 'sine') {
  try {
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  } catch { /* ignore */ }
}

export function speak(text: string) {
  try {
    if (!text || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
    u.rate = 0.95;
    u.pitch = 1.1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
