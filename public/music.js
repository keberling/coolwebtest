const PondMusic = (() => {
  const NOTE = {
    C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0,
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
    C5: 523.25, E5: 659.25, G5: 783.99,
  };

  const MELODY = [
    ['E4', 1], ['G4', 1], ['A4', 2],
    ['G4', 1], ['E4', 1], ['C4', 2],
    ['D4', 1], ['E4', 1], ['G4', 2],
    ['E4', 1], ['D4', 1], ['C4', 2],
    ['G4', 1], ['A4', 1], ['C5', 2],
    ['A4', 1], ['G4', 1], ['E4', 2],
    ['G4', 1], ['E4', 1], ['C4', 2],
    ['E4', 1], ['G4', 1], ['A4', 2],
  ];

  const CHORDS = [
    ['C3', 'E3', 'G3'],
    ['A3', 'C4', 'E4'],
    ['F3', 'A3', 'C4'],
    ['G3', 'C4', 'E4'],
  ];

  const BPM = 84;
  const BEAT = 60 / BPM;
  const LOOKAHEAD = 0.12;
  const SCHEDULE_MS = 25;
  const STORAGE_KEY = 'fishy-pond-music';

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let playing = false;
  let muted = localStorage.getItem(STORAGE_KEY) === 'off';
  let step = 0;
  let nextNote = 0;
  let timer = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    sfxBus.gain.value = 0.7;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
    setMuted(muted);
  }

  function setMuted(value) {
    muted = value;
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
    if (master) master.gain.value = muted ? 0 : 0.42;
    return muted;
  }

  function toggleMute() {
    return setMuted(!muted);
  }

  function isMuted() {
    return muted;
  }

  function pluck(freq, time, dur, vol = 0.18) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + dur);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function padChord(notes, time, dur) {
    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(NOTE[n] || n, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.04 - i * 0.006, time + 0.35);
      gain.gain.linearRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain);
      gain.connect(musicBus);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    });
  }

  function scheduleStep(time) {
    const [noteName, beats] = MELODY[step % MELODY.length];
    pluck(NOTE[noteName], time, beats * BEAT * 0.92);

    if (step % 4 === 0) {
      const chord = CHORDS[(step / 4) % CHORDS.length];
      padChord(chord, time, BEAT * 4.2);
    }

    if (step % 8 === 0) {
      pluck(NOTE.G3, time + BEAT * 0.5, BEAT * 0.8, 0.08);
      pluck(NOTE.C4, time + BEAT * 1.5, BEAT * 0.8, 0.07);
    }

    step += 1;
    nextNote += beats * BEAT;
  }

  function scheduler() {
    if (!playing || !ctx) return;
    while (nextNote < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(nextNote);
    }
  }

  function start() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    if (playing) return;
    playing = true;
    step = 0;
    nextNote = ctx.currentTime + 0.15;
    timer = setInterval(scheduler, SCHEDULE_MS);
  }

  function stop() {
    playing = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function unlock() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    if (!muted) start();
  }

  function tone(freq, time, dur, type = 'sine', vol = 0.2, bus = sfxBus) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function playSplash() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    noise.start(t);
    tone(220, t + 0.03, 0.12, 'sine', 0.08);
  }

  function playBite() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    tone(523.25, t, 0.08, 'square', 0.1);
    tone(659.25, t + 0.09, 0.1, 'square', 0.12);
    tone(783.99, t + 0.19, 0.14, 'square', 0.14);
  }

  function playCatch() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => tone(n, t + i * 0.1, 0.18, 'triangle', 0.16));
    tone(1318.5, t + 0.42, 0.28, 'triangle', 0.14);
  }

  function playMiss() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    tone(349.23, t, 0.15, 'sine', 0.1);
    tone(293.66, t + 0.14, 0.22, 'sine', 0.09);
  }

  return {
    unlock,
    start,
    stop,
    toggleMute,
    isMuted,
    playSplash,
    playBite,
    playCatch,
    playMiss,
  };
})();