export interface CompressorParams {
  threshold: number; // dB
  ratio: number;     // 1:X
  attack: number;    // ms
  release: number;   // ms
  makeupGain: number;// dB
}

export interface ProcessedAudioData {
  inputBuffer: Float32Array;
  outputBuffer: Float32Array;
  gainReductionBuffer: Float32Array; // 0 to 1 scale (linear gain reduction)
  maxReductiondB: number;
  duration: number; // seconds
  sampleRate: number;
}