const HowlCtor = (typeof window !== 'undefined' && (window.Howl || (window.Howler && window.Howler.Howl))) || null;
const Howler = (typeof window !== 'undefined' && window.Howler) || null;

let muted = false;

export const sounds = {
  flip: HowlCtor ? new HowlCtor({ src: ['/sounds/flip.mp3'], volume: 0.4, preload: false }) : { play() {} },
  play: HowlCtor ? new HowlCtor({ src: ['/sounds/play.mp3'], volume: 0.5, preload: false }) : { play() {} },
  win: HowlCtor ? new HowlCtor({ src: ['/sounds/win.mp3'], volume: 0.6, preload: false }) : { play() {} },
};

export function tryPlay(sound) {
  if (muted) return;
  try { sound.play(); } catch (_) {}
}

export function setMuted(next) {
  muted = !!next;
  try {
    if (Howler && typeof Howler.mute === 'function') Howler.mute(muted);
  } catch (_) {}
  try {
    localStorage.setItem('flipout-muted', JSON.stringify(muted));
  } catch (_) {}
}

export function getMuted() {
  try {
    const v = JSON.parse(localStorage.getItem('flipout-muted') || 'false');
    muted = !!v;
  } catch (_) {}
  return muted;
}