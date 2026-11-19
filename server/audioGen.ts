/**
 * Generates a warm, seamless 24-second instrumental ambient WAV buffer
 * in memory for out-of-the-box studio atmosphere before custom MP3s
 * are uploaded to Google Drive (TRILHA-SONORA/).
 * Supports HTTP Range Requests cleanly.
 */

let cachedWavBuffer: Buffer | null = null;

export function getAmbientWavBuffer(): Buffer {
  if (cachedWavBuffer) return cachedWavBuffer;

  const sampleRate = 22050;
  const durationSec = 24;
  const numChannels = 1;
  const bitsPerSample = 16;
  const totalSamples = sampleRate * durationSec;
  const dataSize = totalSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Warm ambient minor-9th chord progression (Dm9 -> Am9 -> Bbmaj7 -> Am7)
  // Using soft sine partials + slow LFO swell for soothing studio ambience
  const chords = [
    [146.83, 220.0, 261.63, 329.63], // Dm9
    [110.0, 164.81, 246.94, 329.63], // Am9
    [116.54, 174.61, 220.0, 293.66], // Bbmaj7
    [110.0, 196.0, 261.63, 329.63],  // Am7
  ];

  const samplesPerChord = totalSamples / chords.length;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(chords.length - 1, Math.floor(i / samplesPerChord));
    const localPos = (i % samplesPerChord) / samplesPerChord;

    // Smooth crossfade envelope per 6-second bar + seamless loop fade
    const barEnv = Math.sin(Math.PI * localPos);
    const loopFade =
      t < 1.0 ? t : t > durationSec - 1.0 ? durationSec - t : 1.0;
    const lfo = 0.78 + 0.22 * Math.sin(2 * Math.PI * 0.125 * t);

    const freqs = chords[chordIdx];
    let sample = 0;
    for (let f = 0; f < freqs.length; f++) {
      const freq = freqs[f];
      const weight = f === 0 ? 0.35 : 0.2;
      sample +=
        weight *
        (Math.sin(2 * Math.PI * freq * t) +
          0.18 * Math.sin(2 * Math.PI * freq * 2 * t));
    }

    const amplitude = 0.26 * barEnv * loopFade * lfo;
    const pcm = Math.max(-1, Math.min(1, sample * amplitude));
    buffer.writeInt16LE(Math.round(pcm * 32767), 44 + i * 2);
  }

  cachedWavBuffer = buffer;
  return cachedWavBuffer;
}
