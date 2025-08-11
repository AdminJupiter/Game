const HowlCtor = (typeof window !== 'undefined' && (window.Howl || (window.Howler && window.Howler.Howl))) || null;

export const sounds = {
  flip: HowlCtor ? new HowlCtor({ src: ['/sounds/flip.mp3'], volume: 0.4, preload: false }) : { play() {} },
  play: HowlCtor ? new HowlCtor({ src: ['/sounds/play.mp3'], volume: 0.5, preload: false }) : { play() {} },
  win: HowlCtor ? new HowlCtor({ src: ['/sounds/win.mp3'], volume: 0.6, preload: false }) : { play() {} },
};

export function tryPlay(sound) {
  try { sound.play(); } catch (_) {}
}