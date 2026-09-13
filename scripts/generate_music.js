// scripts/generate_music.js
// Procedural music generator for Bilbao Shroom Experience background tracks.
// Generates looping 16-bit stereo PCM audio files for Level 1 to Level 5.

import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 44100;
const DURATION_SEC = 10.0;
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);

function createWavHeader(numSamples, sampleRate = 44100, numChannels = 2) {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function writeTrack(filename, generatorFn) {
  const wavHeader = createWavHeader(TOTAL_SAMPLES, SAMPLE_RATE, 2);
  const dataBuffer = Buffer.alloc(TOTAL_SAMPLES * 4); // 2 channels * 2 bytes

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    // Seamless loop windowing (fade at extreme edges)
    const loopFade = Math.min(1.0, Math.min(t / 0.15, (DURATION_SEC - t) / 0.15));

    const [leftSample, rightSample] = generatorFn(t);
    const clampedL = Math.max(-1, Math.min(1, leftSample * loopFade));
    const clampedR = Math.max(-1, Math.min(1, rightSample * loopFade));

    const intL = Math.floor(clampedL * 32767);
    const intR = Math.floor(clampedR * 32767);

    dataBuffer.writeInt16LE(intL, i * 4);
    dataBuffer.writeInt16LE(intR, i * 4 + 2);
  }

  const outDir = path.resolve('public/audio/music');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const fullPath = path.join(outDir, filename);
  fs.writeFileSync(fullPath, Buffer.concat([wavHeader, dataBuffer]));
  console.log(`Generated: ${fullPath} (${(fullPath.length / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// LEVEL 1: Viki Lakása (Apartment - Lo-Fi Psychedelic Chill)
// Dm9 -> G13 -> Cmaj9 -> Am7 (warm Rhodes tones with vibrato)
// -------------------------------------------------------------
writeTrack('level1.mp3', (t) => {
  const bpm = 72;
  const beat = (t * (bpm / 60)) % 8; // 8-beat progression (about 6.67 sec)
  const bar = Math.floor(beat / 2); // 4 bars

  // Chords: Dm9, G13, Cmaj9, Am7
  const chords = [
    [146.83, 220.00, 261.63, 329.63, 440.00], // D3, A3, C4, E4, A4
    [196.00, 246.94, 329.63, 392.00, 440.00], // G3, B3, E4, G4, A4
    [130.81, 196.00, 246.94, 329.63, 392.00], // C3, G3, B3, E4, G4
    [110.00, 164.81, 220.00, 261.63, 329.63], // A2, E3, A3, C4, E4
  ];

  const currentChord = chords[bar % 4];
  let sig = 0;
  const vibrato = Math.sin(2 * Math.PI * 4.5 * t) * 0.006;

  for (let i = 0; i < currentChord.length; i++) {
    const freq = currentChord[i] * (1 + vibrato);
    const wave = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t);
    sig += wave * (0.12 / (i + 1));
  }

  // Soft vinyl noise / mellow low pass
  const noise = (Math.random() - 0.5) * 0.015;
  const bass = Math.sin(2 * Math.PI * (currentChord[0] * 0.5) * t) * 0.22;

  const left = (sig * 0.7 + bass + noise) * 0.65;
  const right = (sig * 0.75 + bass + noise) * 0.65;
  return [left, right];
});

// -------------------------------------------------------------
// LEVEL 2: Madariaga Avenue & Kisbolt (Urban Groove / Funk Bass)
// F minor upbeat walking groove with funk bass
// -------------------------------------------------------------
writeTrack('level2.mp3', (t) => {
  const bpm = 98;
  const beat = (t * (bpm / 60)) % 16;
  const beatFraction = beat % 1;

  // Funky Bassline (F minor: F, Ab, Bb, C, Eb)
  const bassFreqs = [87.31, 87.31, 103.83, 116.54, 87.31, 130.81, 116.54, 103.83];
  const bassIdx = Math.floor((beat * 2) % 8);
  const bassFreq = bassFreqs[bassIdx];
  const bassEnv = Math.max(0, 1 - (beatFraction * 2) % 1);
  const bass = (Math.sin(2 * Math.PI * bassFreq * t) + 0.4 * Math.sin(2 * Math.PI * bassFreq * 2 * t)) * bassEnv * 0.35;

  // Brass/Synth stab on 2 and 4
  const isStab = (Math.floor(beat) % 2 === 1) && (beatFraction < 0.25);
  let stab = 0;
  if (isStab) {
    const env = 1 - beatFraction / 0.25;
    stab = (Math.sin(2 * Math.PI * 349.23 * t) + Math.sin(2 * Math.PI * 415.30 * t) + Math.sin(2 * Math.PI * 523.25 * t)) * env * 0.15;
  }

  // Hi-hat tick
  const isHihat = (beat * 2) % 1 < 0.08;
  const hihat = isHihat ? (Math.random() - 0.5) * 0.06 : 0;

  return [bass + stab * 0.8 + hihat, bass + stab * 1.2 + hihat];
});

// -------------------------------------------------------------
// LEVEL 3: 1-es Metróvonal (Underground Synthwave / Subway Neon)
// Driving 16th-note arpeggiator (C minor)
// -------------------------------------------------------------
writeTrack('level3.mp3', (t) => {
  const bpm = 118;
  const step = Math.floor(t * (bpm / 60) * 4) % 16; // 16th notes
  const arpNotes = [
    130.81, 155.56, 196.00, 261.63, // C3, Eb3, G3, C4
    155.56, 196.00, 261.63, 311.13, // Eb3, G3, C4, Eb4
    116.54, 146.83, 174.61, 233.08, // Bb2, D3, F3, Bb3
    103.83, 130.81, 155.56, 207.65, // Ab2, C3, Eb3, Ab3
  ];

  const freq = arpNotes[step];
  const stepFract = (t * (bpm / 60) * 4) % 1;
  const env = Math.exp(-stepFract * 6.0); // Plucky synth envelope

  // Resonant sawtooth emulation
  let synth = 0;
  for (let h = 1; h <= 4; h++) {
    synth += (Math.sin(2 * Math.PI * freq * h * t) / h) * env * 0.18;
  }

  // Deep kick on quarter notes
  const isKick = (t * (bpm / 60)) % 1 < 0.15;
  const kick = isKick ? Math.sin(2 * Math.PI * 55 * (1 - (t * (bpm / 60)) % 1) * t) * 0.35 : 0;

  const pan = Math.sin(t * 1.5) * 0.3;
  return [(synth * (1 - pan) + kick) * 0.8, (synth * (1 + pan) + kick) * 0.8];
});

// -------------------------------------------------------------
// LEVEL 4: Larrabasterra Suburban Coast (Breezy Melodic Guitars & Chimes)
// E major -> B/D# -> C#m7 -> Aadd9
// -------------------------------------------------------------
writeTrack('level4.mp3', (t) => {
  const bpm = 84;
  const beat = (t * (bpm / 60)) % 16;
  const chordIdx = Math.floor(beat / 4);

  const roots = [82.41, 73.42, 69.30, 55.00]; // E2, D#2, C#2, A1
  const bells = [
    [329.63, 493.88, 659.25], // E4, B4, E5
    [293.66, 493.88, 587.33], // D4, B4, D5
    [277.18, 415.30, 554.37], // C#4, G#4, C#5
    [220.00, 440.00, 554.37], // A3, A4, C#5
  ];

  const rootFreq = roots[chordIdx % 4];
  const bellSet = bells[chordIdx % 4];

  // Acoustic sub bass
  const bass = Math.sin(2 * Math.PI * rootFreq * t) * 0.25;

  // Gentle chiming bells
  let chime = 0;
  for (let b = 0; b < bellSet.length; b++) {
    const f = bellSet[b];
    chime += Math.sin(2 * Math.PI * f * t) * 0.08 * (1 + 0.2 * Math.sin(t * 3));
  }

  // Soft acoustic guitar strum pulse
  const strumEnv = Math.exp(-((beat % 1) * 3.5));
  const strum = Math.sin(2 * Math.PI * rootFreq * 2 * t) * strumEnv * 0.12;

  return [(bass + chime * 0.9 + strum) * 0.7, (bass + chime * 1.1 + strum) * 0.7];
});

// -------------------------------------------------------------
// LEVEL 5: Sopelana Beach (Sunset Flysch Ocean Meditation)
// Dsus2 ocean swells, deep sub bass, pentatonic meditative chimes
// -------------------------------------------------------------
writeTrack('level5.mp3', (t) => {
  // Ocean wave swell simulation (pink noise / filtered low frequencies)
  const swell = (Math.sin(2 * Math.PI * 0.12 * t) * 0.5 + 0.5); // Slow 8-second wave breath
  const ocean = (Math.random() - 0.5) * 0.04 * swell;

  // Deep meditative drone: D2 (73.42 Hz) + A2 (110.00 Hz) + D3 (146.83 Hz)
  const drone1 = Math.sin(2 * Math.PI * 73.42 * t) * 0.25;
  const drone2 = Math.sin(2 * Math.PI * 110.00 * t) * 0.18;
  const drone3 = Math.sin(2 * Math.PI * 146.83 * t) * 0.12;
  const warmDrone = drone1 + drone2 + drone3;

  // Slow twinkling star / sunset chimes: D, E, F#, A, B
  const chimeFreqs = [587.33, 659.25, 739.99, 880.00, 987.77];
  const chimePhase = (t * 0.4) % 5;
  const chimeIdx = Math.floor(chimePhase);
  const chimeEnv = Math.max(0, 1 - (chimePhase % 1) * 2.5);
  const chime = Math.sin(2 * Math.PI * chimeFreqs[chimeIdx] * t) * chimeEnv * 0.12;

  const left = (warmDrone + ocean * 1.2 + chime * 0.8) * 0.75;
  const right = (warmDrone + ocean * 0.8 + chime * 1.2) * 0.75;
  return [left, right];
});

console.log('All 5 level music tracks successfully generated in public/audio/music/!');
