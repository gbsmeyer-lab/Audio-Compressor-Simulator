import { CompressorParams, ProcessedAudioData } from '../types';

const SAMPLE_RATE = 44100;
const DURATION = 3.0; // Seconds for the loop

/**
 * Generates a synthetic drum loop pattern (Kick, Snare, Hat)
 */
export const generateTestSignal = (): Float32Array => {
  const length = SAMPLE_RATE * DURATION;
  const buffer = new Float32Array(length);

  // Helper to add a tone/hit
  const addHit = (startSec: number, type: 'kick' | 'snare' | 'hat', amp: number) => {
    const startSample = Math.floor(startSec * SAMPLE_RATE);
    
    for (let i = 0; i < SAMPLE_RATE * 0.5; i++) {
      const idx = startSample + i;
      if (idx >= length) break;
      
      const t = i / SAMPLE_RATE;
      let sample = 0;

      if (type === 'kick') {
        // Pitch drop sine + noise click
        const freq = 150 * Math.exp(-t * 20); 
        sample = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5);
        if (i < 100) sample += (Math.random() - 0.5) * 0.5; // Click
      } else if (type === 'snare') {
        // Noise + body sine
        const noise = (Math.random() - 0.5) * 2 * Math.exp(-t * 15);
        const body = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 8);
        sample = (noise * 0.8) + (body * 0.4);
      } else if (type === 'hat') {
        // Highpass noise
        const noise = (Math.random() - 0.5) * 2 * Math.exp(-t * 40);
        sample = noise * 0.3;
      }

      buffer[idx] += sample * amp;
    }
  };

  // Simple Beat Pattern
  addHit(0.0, 'kick', 1.0);
  addHit(0.5, 'hat', 0.5);
  addHit(1.0, 'snare', 0.9);
  addHit(1.5, 'hat', 0.5);
  addHit(1.75, 'hat', 0.3);
  addHit(2.0, 'kick', 1.0);
  addHit(2.25, 'kick', 0.6);
  addHit(2.5, 'snare', 0.9);

  return buffer;
};

/**
 * Applies digital compression logic to the input buffer.
 * This simulates the compressor to generate visualization data.
 */
export const processAudio = (
  input: Float32Array,
  params: CompressorParams
): ProcessedAudioData => {
  const output = new Float32Array(input.length);
  const grBuffer = new Float32Array(input.length);
  
  // Compressor coefficients
  // Attack/Release time constants to filter coefficients
  // alpha = exp(-1 / (time * sampleRate))
  const attackCoeff = Math.exp(-1 / ((params.attack / 1000) * SAMPLE_RATE));
  const releaseCoeff = Math.exp(-1 / ((params.release / 1000) * SAMPLE_RATE));
  
  let envelope = 0;
  let maxReductiondB = 0;

  // Linear Makeup Gain
  const makeupLinear = Math.pow(10, params.makeupGain / 20);

  for (let i = 0; i < input.length; i++) {
    const inputSample = input[i];
    const inputAbs = Math.abs(inputSample);

    // 1. Level Detection (Peak Sensing with smoothing could be used, but raw peak is standard for basic digital comps)
    // We smooth the detector slightly usually, but for this demo, we apply ballistics to the gain reduction.
    
    // Convert to dB
    // Avoid log(0)
    const inputdB = inputAbs < 0.000001 ? -100 : 20 * Math.log10(inputAbs);

    // 2. Gain Computer
    let targetGRdB = 0;
    if (inputdB > params.threshold) {
      // Amount we are over the threshold
      const overdB = inputdB - params.threshold;
      // Output should be: Threshold + (over / Ratio)
      // So Gain Reduction is: over - (over / Ratio)
      targetGRdB = overdB * (1 - 1 / params.ratio); 
    } else {
      targetGRdB = 0;
    }

    // targetGRdB is positive representing the amount to reduce. 
    // e.g. 6dB reduction.
    
    // 3. Ballistics (Attack / Release on the Gain Reduction Envelope)
    // We track the current applied reduction (envelope)
    if (targetGRdB > envelope) {
      // Attack phase (Gain Reduction is increasing, meaning signal is getting quieter)
      envelope = attackCoeff * envelope + (1 - attackCoeff) * targetGRdB;
    } else {
      // Release phase (Gain Reduction is decreasing, return to unity)
      envelope = releaseCoeff * envelope + (1 - releaseCoeff) * targetGRdB;
    }

    // 4. Apply Gain
    // current gain (linear) = 10 ^ (-envelope / 20)
    const currentGainReductionLinear = Math.pow(10, -envelope / 20);
    
    output[i] = inputSample * currentGainReductionLinear * makeupLinear;
    grBuffer[i] = currentGainReductionLinear;

    if (envelope > maxReductiondB) {
      maxReductiondB = envelope;
    }
  }

  return {
    inputBuffer: input,
    outputBuffer: output,
    gainReductionBuffer: grBuffer,
    maxReductiondB,
    duration: DURATION,
    sampleRate: SAMPLE_RATE
  };
};

/**
 * Creates an AudioBuffer from data for playback
 */
export const createAudioBuffer = (ctx: AudioContext, data: Float32Array): AudioBuffer => {
  const buffer = ctx.createBuffer(1, data.length, SAMPLE_RATE);
  buffer.copyToChannel(data, 0);
  return buffer;
};