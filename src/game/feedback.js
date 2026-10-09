export const REVEAL_MS = 750;
export const MILESTONE_MS = 1200;

export function milestoneBanner(streak) {
  if (streak === 10 || streak === 25 || streak === 50) return `${streak} streak`;
  if (streak === 11) return "Hard mode unlocked";
  if (streak === 21) return "Expert mode";
  return "";
}

export function streakCallout(streak) {
  if (milestoneBanner(streak)) return "";
  if (streak === 5) return "🔥 Hot streak";
  return "";
}

export function playBuzzer() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const tone = context.createOscillator();
  const gain = context.createGain();
  tone.type = "sawtooth";
  tone.frequency.setValueAtTime(210, context.currentTime);
  tone.frequency.exponentialRampToValueAtTime(80, context.currentTime + 0.24);
  gain.gain.setValueAtTime(0.05, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
  tone.connect(gain);
  gain.connect(context.destination);
  tone.start();
  tone.stop(context.currentTime + 0.28);
  tone.onended = () => context.close();
}
