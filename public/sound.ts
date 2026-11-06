/*  (o) OneDime | public/sound.ts
 *  ----------------------------------------------------------
 *  Browser synthesized music and interface sounds from the public score.
 */
type SoundName = "click" | "tab" | "select" | "back" | "reward" | "tileBreak";
type SoundSettings = { clicks: boolean; music: boolean; volume: number };
type ThemeNote = { i: string; start: number; dur: number; midi: number };
type UiNote = { midi: number; dur: number };
type Instrument = {
  wave: "pulse" | "triangle" | "sine" | "noise";
  duty?: number;
  gain: number;
  attack: number;
  release: number;
  highpassHz?: number;
  bandpassHz?: number;
  pitchFromHz?: number;
  pitchToHz?: number;
  vibratoHz?: number;
  vibratoDepth?: number;
  vibratoDelay?: number;
  echo?: { time: number; feedback: number };
};
type Theme = {
  bpm: number;
  loopSeconds: number;
  masterLowpassHz: number;
  instruments: Record<string, Instrument>;
  notes: ThemeNote[];
  ui: Record<Exclude<SoundName, "tileBreak">, UiNote[]> & { tileBreak: string };
};
type AudioWindow = Window & { __ONEDIME_DEMO_VIDEO__?: boolean };

const settingsKey = "onedime-sound";
const defaults: SoundSettings = { clicks: true, music: false, volume: 0.35 };
const demoVideo = (window as AudioWindow).__ONEDIME_DEMO_VIDEO__ === true;
let settings = readSettings();
let themePromise: Promise<Theme> | null = demoVideo
  ? null
  : fetch("/audio/theme.json").then(response => {
      if (!response.ok) throw new Error("Sound score could not be loaded.");
      return response.json() as Promise<Theme>;
    });
let audioContext: AudioContext | null = null;
let lowpass: BiquadFilterNode | null = null;
let musicBus: GainNode | null = null;
let effectsBus: GainNode | null = null;
let delay: DelayNode | null = null;
let feedback: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let scheduler: number | null = null;
let musicStarted = false;
let nextLoopStart = 0;
let nextNoteIndex = 0;
let sortedNotes: ThemeNote[] = [];
let lastUiSoundAt = -Infinity;
let queuedSounds: SoundName[] = [];
let queueTimer: number | null = null;
let userGestureSeen = false;
const activeMusicSources = new Set<AudioScheduledSourceNode>();
const periodicWaves = new Map<number, PeriodicWave>();

if (themePromise) void themePromise.catch(() => {});

function readSettings(): SoundSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem(settingsKey) ?? "null"
    ) as Partial<SoundSettings> | null;
    if (stored && typeof stored.clicks === "boolean" && typeof stored.music === "boolean"
      && typeof stored.volume === "number" && Number.isFinite(stored.volume)
      && stored.volume >= 0 && stored.volume <= 1)
      return { clicks: stored.clicks, music: stored.music, volume: stored.volume };
  } catch { /* Sound uses its defaults when storage is unavailable or malformed. */ }
  return { ...defaults };
}

function saveSettings() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch { /* Audio still works without storage. */ }
  applySettings();
}

function modeName() {
  if (settings.clicks && settings.music) return "Clicks and music";
  if (settings.clicks) return "Clicks";
  if (settings.music) return "Music only";
  return "Off";
}

function applySettings() {
  const clicks = document.getElementById("sound-clicks") as HTMLInputElement | null;
  const music = document.getElementById("sound-music") as HTMLInputElement | null;
  const volume = document.getElementById("sound-volume") as HTMLInputElement | null;
  if (clicks) clicks.checked = settings.clicks;
  if (music) music.checked = settings.music;
  if (volume) volume.value = String(Math.round(settings.volume * 100));
  const volumeValue = document.getElementById("sound-volume-value");
  if (volumeValue) volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;
  const cycle = document.getElementById("sound-cycle") as HTMLButtonElement | null;
  if (cycle) {
    cycle.setAttribute("aria-label", `Sound: ${modeName()}`);
    cycle.title = `Sound: ${modeName()}. Change sound mode`;
    cycle.dataset.mode = modeName().toLowerCase().replaceAll(" ", "-");
  }
  if (musicBus && audioContext) {
    musicBus.gain.setTargetAtTime(
      settings.music ? settings.volume : 0,
      audioContext.currentTime,
      0.015
    );
  }
  if (settings.music && audioContext) startMusic();
  else stopMusic();
}

function applyTheme(theme: Theme) {
  const context = audioContext!;
  if (lowpass) lowpass.frequency.setValueAtTime(theme.masterLowpassHz, context.currentTime);
  const echo = theme.instruments.lead.echo;
  if (echo && delay && feedback) {
    delay.delayTime.setValueAtTime(echo.time, context.currentTime);
    feedback.gain.setValueAtTime(echo.feedback, context.currentTime);
  }
}

function createAudioContext() {
  if (audioContext) return audioContext;
  const context = new AudioContext();
  audioContext = context;
  lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 6000;
  lowpass.connect(context.destination);
  musicBus = context.createGain();
  musicBus.gain.value = settings.music ? settings.volume : 0;
  musicBus.connect(lowpass);
  effectsBus = context.createGain();
  effectsBus.connect(lowpass);
  delay = context.createDelay(1);
  feedback = context.createGain();
  delay.delayTime.value = 0.3;
  feedback.gain.value = 0.25;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(musicBus);
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return context;
}

function pulseWave(context: AudioContext, duty: number) {
  const saved = periodicWaves.get(duty);
  if (saved) return saved;
  const harmonics = 48;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
    real[harmonic] = Math.sin(2 * Math.PI * harmonic * duty) / (Math.PI * harmonic);
    imag[harmonic] = (1 - Math.cos(2 * Math.PI * harmonic * duty)) / (Math.PI * harmonic);
  }
  const wave = context.createPeriodicWave(real, imag);
  periodicWaves.set(duty, wave);
  return wave;
}

function midiHz(midi: number) { return 440 * 2 ** ((midi - 69) / 12); }

function envelope(
  context: AudioContext,
  start: number,
  end: number,
  attack: number,
  release: number,
  peak: number
) {
  const gain = context.createGain();
  const attackEnd = Math.min(start + attack, start + (end - start) * 0.4);
  const releaseStart = Math.max(attackEnd, end - Math.min(release, (end - start) * 0.65));
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, attackEnd);
  gain.gain.setValueAtTime(peak, releaseStart);
  gain.gain.linearRampToValueAtTime(0.0001, end);
  return gain;
}

function trackMusic(source: AudioScheduledSourceNode) {
  activeMusicSources.add(source);
  source.addEventListener("ended", () => activeMusicSources.delete(source), { once: true });
}

function makeVoice(
  instrument: Instrument,
  midi: number,
  start: number,
  seconds: number,
  isMusic: boolean
) {
  const context = audioContext!;
  const end = start + seconds;
  const source = instrument.wave === "noise"
    ? context.createBufferSource()
    : context.createOscillator();
  if (instrument.wave === "noise") {
    (source as AudioBufferSourceNode).buffer = noiseBuffer;
    (source as AudioBufferSourceNode).loop = true;
  } else {
    const oscillator = source as OscillatorNode;
    if (instrument.wave === "pulse")
      oscillator.setPeriodicWave(pulseWave(context, instrument.duty ?? 0.25));
    else oscillator.type = instrument.wave;
    const startHz = instrument.wave === "sine" && instrument.pitchFromHz
      ? instrument.pitchFromHz
      : midiHz(midi);
    oscillator.frequency.setValueAtTime(startHz, start);
    if (instrument.wave === "sine" && instrument.pitchToHz) {
      const pitchDropEnd = Math.min(end, start + Math.min(0.12, seconds * 0.8));
      oscillator.frequency.exponentialRampToValueAtTime(instrument.pitchToHz, pitchDropEnd);
    }
    if (instrument.vibratoHz && instrument.vibratoDepth && instrument.vibratoDelay !== undefined) {
      const vibrato = context.createOscillator();
      const vibratoGain = context.createGain();
      vibrato.frequency.value = instrument.vibratoHz;
      vibratoGain.gain.value = midiHz(midi) * instrument.vibratoDepth;
      vibrato.connect(vibratoGain).connect(oscillator.frequency);
      const vibratoStart = Math.min(end - 0.005, start + instrument.vibratoDelay);
      if (vibratoStart > start) {
        vibrato.start(vibratoStart);
        vibrato.stop(end);
        if (isMusic) trackMusic(vibrato);
      }
    }
  }
  const gain = envelope(context, start, end, instrument.attack, instrument.release, instrument.gain);
  if (instrument.highpassHz || instrument.bandpassHz) {
    const filter = context.createBiquadFilter();
    filter.type = instrument.highpassHz ? "highpass" : "bandpass";
    filter.frequency.value = instrument.highpassHz ?? instrument.bandpassHz!;
    source.connect(filter).connect(gain);
  } else source.connect(gain);
  const bus = isMusic ? musicBus! : effectsBus!;
  gain.connect(bus);
  if (isMusic && instrument.echo && delay) gain.connect(delay);
  source.start(start);
  source.stop(end + 0.005);
  if (isMusic) trackMusic(source);
  return source;
}

function scheduleMusicNote(note: ThemeNote, at: number, theme: Theme) {
  const instrument = theme.instruments[note.i];
  if (!instrument) return;
  const secondsPerBeat = 60 / theme.bpm;
  makeVoice(instrument, note.midi, at, note.dur * secondsPerBeat, true);
}

function scheduleMusic() {
  if (!musicStarted || !audioContext || !themePromise || document.hidden) return;
  void themePromise.then(theme => {
    if (!musicStarted || !audioContext || document.hidden) return;
    applyTheme(theme);
    if (!sortedNotes.length) sortedNotes = [...theme.notes].sort((left, right) => left.start - right.start);
    const horizon = audioContext.currentTime + 0.1;
    while (true) {
      const note = sortedNotes[nextNoteIndex];
      const at = nextLoopStart + note.start * 60 / theme.bpm;
      if (at > horizon) break;
      scheduleMusicNote(note, at, theme);
      nextNoteIndex++;
      if (nextNoteIndex >= sortedNotes.length) {
        nextNoteIndex = 0;
        nextLoopStart += theme.loopSeconds;
      }
    }
  }).catch(() => stopMusic());
}

function startScheduler() {
  if (!musicStarted || !audioContext || document.hidden || scheduler !== null) return;
  if (!sortedNotes.length) {
    void themePromise?.then(theme => {
      if (!musicStarted || !audioContext || document.hidden || scheduler !== null) return;
      sortedNotes = [...theme.notes].sort((left, right) => left.start - right.start);
      nextLoopStart = audioContext.currentTime + 0.05;
      scheduler = window.setInterval(scheduleMusic, 25);
      scheduleMusic();
    }).catch(() => stopMusic());
    return;
  }
  scheduler = window.setInterval(scheduleMusic, 25);
  scheduleMusic();
}

function startMusic() {
  if (!settings.music || demoVideo || document.hidden || !themePromise) return;
  const context = createAudioContext();
  if (!musicStarted) {
    musicStarted = true;
    nextNoteIndex = 0;
    nextLoopStart = context.currentTime + 0.05;
  }
  musicBus!.gain.setTargetAtTime(settings.volume, context.currentTime, 0.015);
  void context.resume().then(startScheduler).catch(() => {});
  if (context.state === "running") startScheduler();
}

function stopMusic() {
  musicStarted = false;
  if (scheduler !== null) window.clearInterval(scheduler);
  scheduler = null;
  if (audioContext && musicBus) {
    const now = audioContext.currentTime;
    musicBus.gain.setTargetAtTime(0, now, 0.008);
    feedback?.gain.setValueAtTime(0, now);
    delay?.delayTime.setValueAtTime(0.001, now);
    delay?.delayTime.setValueAtTime(0.3, now + 0.02);
    for (const source of activeMusicSources) {
      try { source.stop(now + 0.01); } catch { /* The voice has already ended. */ }
    }
    activeMusicSources.clear();
  }
}

async function emitUiSound(name: SoundName) {
  if (!settings.clicks || document.hidden || !themePromise) return;
  const context = audioContext;
  if (!context) return;
  try {
    const theme = await themePromise;
    if (!settings.clicks || document.hidden || context !== audioContext) return;
    applyTheme(theme);
    if (name === "tileBreak") {
      const durationMs = Number(theme.ui.tileBreak.match(/(\d+)\s*ms/i)?.[1] ?? 90);
      const cutoffHz = Number(theme.ui.tileBreak.match(/lowpass\s+(\d+)\s*Hz/i)?.[1] ?? 2500);
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoffHz;
      const duration = durationMs / 1000;
      const start = context.currentTime + 0.005;
      const gain = envelope(
        context,
        start,
        start + duration,
        0.001,
        Math.min(0.07, duration * 0.8),
        0.2
      );
      source.connect(filter).connect(gain).connect(effectsBus!);
      source.start(context.currentTime + 0.005);
      source.stop(context.currentTime + 0.01 + duration);
      return;
    }
    const notes = theme.ui[name];
    const instrument = theme.instruments.keys;
    let at = context.currentTime + 0.005;
    for (const note of notes) {
      makeVoice(instrument, note.midi, at, note.dur, false);
      at += note.dur;
    }
  } catch { /* Missing or unavailable sound never blocks the app. */ }
}

function playUserSound(name: SoundName) {
  if (demoVideo || document.hidden) return;
  unlockForAudio();
  if (!settings.clicks && !settings.music) return;
  const now = performance.now();
  try {
    createAudioContext();
    void audioContext!.resume().then(() => { if (settings.music) startMusic(); }).catch(() => {});
    if (!settings.clicks || now - lastUiSoundAt < 40) return;
    lastUiSoundAt = now;
    void emitUiSound(name);
  } catch { /* Unsupported audio leaves the controls usable. */ }
}

function unlockForAudio() {
  userGestureSeen = true;
  if ((!settings.clicks && !settings.music) || demoVideo || document.hidden) return;
  try {
    const context = createAudioContext();
    void context.resume().then(() => { if (settings.music) startMusic(); }).catch(() => {});
    if (context.state === "running" && settings.music) startMusic();
  } catch { /* Unsupported audio leaves the controls usable. */ }
}

function queueProgressSound(name: "reward" | "tileBreak") {
  if (!settings.clicks || demoVideo || !userGestureSeen) return;
  queuedSounds.push(name);
  drainSoundQueue();
}

function drainSoundQueue() {
  if (queueTimer !== null || !queuedSounds.length || !settings.clicks) return;
  const delayMs = Math.max(0, 40 - (performance.now() - lastUiSoundAt));
  queueTimer = window.setTimeout(() => {
    queueTimer = null;
    const name = queuedSounds.shift();
    if (name && settings.clicks && !document.hidden && userGestureSeen) {
      lastUiSoundAt = performance.now();
      try {
        createAudioContext();
        void audioContext!.resume().catch(() => {});
        void emitUiSound(name);
      }
      catch { /* Audio remains optional. */ }
    }
    drainSoundQueue();
  }, delayMs);
}

function cycleMode() {
  if (settings.clicks && settings.music) settings = { ...settings, clicks: false, music: false };
  else if (settings.clicks) settings = { ...settings, clicks: true, music: true };
  else settings = { ...settings, clicks: true, music: false };
  saveSettings();
}

export function playReward() { queueProgressSound("reward"); }
export function playTileBreak() { queueProgressSound("tileBreak"); }

export function initializeSound() {
  if (demoVideo) return;
  applySettings();
  document.addEventListener("click", event => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("#btnA")) return playUserSound("select");
    if (target.closest("#btnB")) return playUserSound("back");
    if (target.closest('[data-pad="left"],[data-pad="right"]')) return playUserSound("tab");
    if (target.closest('[role="tab"]')) return playUserSound("tab");
    if (target.closest("button,input,select,textarea,summary,[role='button']"))
      playUserSound("click");
  });
  document.addEventListener("keydown", event => {
    if (!event.isTrusted) return;
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      && (event.target as Element | null)?.closest('[role="tab"]')) playUserSound("tab");
  });
  document.getElementById("sound-open")?.addEventListener("click", () => {
    (document.getElementById("sound-dialog") as HTMLDialogElement).showModal();
  });
  document.getElementById("sound-close")?.addEventListener("click", () => {
    (document.getElementById("sound-dialog") as HTMLDialogElement).close();
  });
  document.getElementById("sound-clicks")?.addEventListener("change", event => {
    settings = { ...settings, clicks: (event.currentTarget as HTMLInputElement).checked };
    saveSettings();
    if (settings.clicks && event.isTrusted) unlockForAudio();
  });
  document.getElementById("sound-music")?.addEventListener("change", event => {
    settings = { ...settings, music: (event.currentTarget as HTMLInputElement).checked };
    saveSettings();
    if (settings.music && event.isTrusted) unlockForAudio();
  });
  document.getElementById("sound-volume")?.addEventListener("input", event => {
    settings = {
      ...settings,
      volume: Number((event.currentTarget as HTMLInputElement).value) / 100
    };
    saveSettings();
  });
  document.getElementById("sound-cycle")?.addEventListener("click", event => {
    cycleMode();
    if (event.isTrusted) unlockForAudio();
  });
  document.addEventListener("visibilitychange", () => {
    if (!audioContext) return;
    if (document.hidden) {
      if (scheduler !== null) window.clearInterval(scheduler);
      scheduler = null;
      void audioContext.suspend().catch(() => {});
      return;
    }
    void audioContext.resume().then(() => {
      if (settings.music && musicStarted) startScheduler();
    }).catch(() => {});
  });
}
