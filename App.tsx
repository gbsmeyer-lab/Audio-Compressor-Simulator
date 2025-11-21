import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Visualizer from './components/Visualizer';
import KnobControl from './components/KnobControl';
import TransferCurve from './components/TransferCurve';
import { CompressorParams, ProcessedAudioData } from './types';
import { generateTestSignal, processAudio, createAudioBuffer } from './services/audioEngine';
import { Play, Pause, RotateCcw, Layers, Power, Sparkles } from 'lucide-react';

const DEFAULT_PARAMS: CompressorParams = {
  threshold: -20,
  ratio: 4,
  attack: 20,
  release: 200,
  makeupGain: 0,
};

const App: React.FC = () => {
  const [params, setParams] = useState<CompressorParams>(DEFAULT_PARAMS);
  const [data, setData] = useState<ProcessedAudioData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // New states
  const [showOriginal, setShowOriginal] = useState(false);
  const [isBypass, setIsBypass] = useState(false);
  const [isDiscoMode, setIsDiscoMode] = useState(false);
  const [limitThreshold, setLimitThreshold] = useState(0); // 0 = Max, basically off in digital
  
  // Max GR Peak Hold
  const [displayMaxGR, setDisplayMaxGR] = useState(0);

  // Audio Synchronization
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  // Use Ref for syncTime to avoid React render latency during rapid updates
  const syncTimeRef = useRef<number>(0); 
  
  // Audio Context Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0); // Tracks the anchor time for the loop

  // 1. Generate Initial Audio Data on Mount
  const originalSignal = useMemo(() => generateTestSignal(), []);

  // 2. Process Audio when Params change
  useEffect(() => {
    const processed = processAudio(originalSignal, params);
    setData(processed);
    
    // Update Peak Hold Logic
    setDisplayMaxGR(prev => {
       if (processed.maxReductiondB > prev) return processed.maxReductiondB;
       return processed.maxReductiondB;
    });

    // If playing and NOT bypassed, update the live audio seamlessly
    if (isPlaying && audioCtxRef.current && !isBypass) {
       restartPlayback(processed.outputBuffer, processed.duration);
    }
  }, [params, originalSignal]);

  // Helper to restart playback seamlessly (keeping sync)
  const restartPlayback = useCallback((bufferData: Float32Array, duration: number) => {
     if (!audioCtxRef.current) return;
     const ctx = audioCtxRef.current;
     
     // Stop old source
     if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
     }

     // Calculate offset to maintain playhead position
     const currentCtxTime = ctx.currentTime;
     let offset = 0;
     
     // If we are already playing, calculate where we are in the loop
     if (startTimeRef.current > 0) {
         offset = (currentCtxTime - startTimeRef.current) % duration;
         if (offset < 0) offset += duration;
     } else {
         // If starting fresh or just reset
         startTimeRef.current = currentCtxTime;
     }

     // Create new buffer and source
     const buffer = createAudioBuffer(ctx, bufferData);
     const source = ctx.createBufferSource();
     source.buffer = buffer;
     source.loop = true;
     source.connect(ctx.destination);
     
     // Start with offset
     source.start(0, offset);
     
     sourceNodeRef.current = source;
     
     // Update the anchor time. 
     // logic: current time = (now - start) % duration
     // We want the visuals to match 'offset'.
     // so visual_t = offset.
     // (now - newStart) = offset
     // newStart = now - offset.
     const newAnchor = currentCtxTime - offset;
     startTimeRef.current = newAnchor;
     
     // Update the ref immediately so the visualizer loop picks it up next frame
     syncTimeRef.current = newAnchor;

  }, []);

  const togglePlay = async () => {
    // Initialize Context if needed
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
      setAudioContext(audioCtxRef.current);
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isPlaying) {
      // Stop
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
        sourceNodeRef.current = null;
      }
      setIsPlaying(false);
      // Reset sync on stop so next start is from 0
      startTimeRef.current = 0;
      syncTimeRef.current = 0;
    } else {
      // Start
      if (data) {
        // Reset start time to ensure we start from 0 if we were stopped
        startTimeRef.current = ctx.currentTime; 
        
        const bufferToPlay = isBypass ? data.inputBuffer : data.outputBuffer;
        restartPlayback(bufferToPlay, data.duration);
        setIsPlaying(true);
      }
    }
  };

  const toggleBypass = () => {
    const newState = !isBypass;
    setIsBypass(newState);
    
    // If currently playing, switch audio source immediately
    if (isPlaying && data) {
      const bufferToPlay = newState ? data.inputBuffer : data.outputBuffer;
      restartPlayback(bufferToPlay, data.duration);
    }
  };

  const resetParams = () => {
    setParams(DEFAULT_PARAMS);
    setLimitThreshold(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans text-slate-200 selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className={`text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r transition-all duration-500 ${isDiscoMode ? 'from-fuchsia-400 via-yellow-400 to-cyan-400 animate-pulse' : 'from-cyan-400 to-blue-500'}`}>
              Audio Compressor {isDiscoMode ? 'PARTY!' : ''}
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Interaktive Simulation: Wellenform & Kennlinie.
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-slate-900 p-3 rounded-lg border border-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <div className="text-xs text-red-400 font-bold uppercase tracking-widest mb-1">Max Gain Reduction</div>
                <div className="text-2xl font-mono text-red-500 tracking-tighter">
                  {displayMaxGR.toFixed(1)} <span className="text-base">dB</span>
                </div>
             </div>
          </div>
        </div>

        {/* Visualization Area - Split Layout */}
        <section className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[340px]">
          
          {/* Main Waveform Visualizer (Takes more space) */}
          <div className="flex-grow h-[300px] lg:h-full flex flex-col gap-2">
            <Visualizer 
              data={data} 
              threshold={params.threshold} 
              isPlaying={isPlaying}
              audioContext={audioContext}
              syncTimeRef={syncTimeRef}
              showInputOverlay={showOriginal}
              isDiscoMode={isDiscoMode}
            />
            
            {/* Toolbar under visualizer */}
            <div className="flex flex-wrap justify-center items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  showOriginal 
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/50' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Layers size={16} />
                {showOriginal ? 'Hide Input' : 'Show Input'}
              </button>

              <button 
                onClick={togglePlay}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all transform hover:scale-105 ${
                  isPlaying 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                }`}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                {isPlaying ? 'Stop' : 'Start Loop'}
              </button>

              <button
                onClick={toggleBypass}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  isBypass 
                    ? 'bg-orange-500 text-white border-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.4)]' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Power size={16} />
                {isBypass ? 'Bypass ON' : 'Bypass'}
              </button>

              <button 
                onClick={resetParams}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Reset to default"
              >
                <RotateCcw size={16} />
              </button>

               {/* MOVED DISCO BUTTON HERE */}
               <button
                  onClick={() => setIsDiscoMode(!isDiscoMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isDiscoMode
                      ? 'bg-fuchsia-900/40 border-fuchsia-500 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)]'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-fuchsia-500/50 hover:text-fuchsia-400'
                  }`}
                  title="Party Mode"
                >
                  <Sparkles size={16} className={isDiscoMode ? 'animate-spin' : ''} />
                  <span>Disco</span>
                </button>
            </div>
          </div>

          {/* Transfer Curve (Fixed width on Large, full on mobile) */}
          <div className="w-full lg:w-[340px] h-[300px] lg:h-full flex-shrink-0">
            <TransferCurve 
              threshold={params.threshold}
              ratio={params.ratio}
              makeupGain={params.makeupGain}
              limitThreshold={limitThreshold}
            />
          </div>
        </section>

        {/* Controls Grid */}
        <section className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800/50 transition-opacity duration-300 ${isBypass ? 'opacity-50 grayscale-[0.5]' : 'opacity-100'}`}>
          
          <KnobControl
            label="Threshold"
            value={params.threshold}
            min={-60}
            max={0}
            unit="dB"
            onChange={(v) => setParams(p => ({ ...p, threshold: v }))}
            description="Ab welchem Pegel der Kompressor greift."
          />

          <KnobControl
            label="Ratio"
            value={params.ratio}
            min={1}
            max={20}
            step={0.5}
            unit=":1"
            onChange={(v) => setParams(p => ({ ...p, ratio: v }))}
            description="Wie stark das Signal über der Schwelle reduziert wird."
          />

          <KnobControl
            label="Attack"
            value={params.attack}
            min={0.1}
            max={100}
            step={0.1}
            unit="ms"
            onChange={(v) => setParams(p => ({ ...p, attack: v }))}
            description="Zeit bis zur vollen Gain Reduction."
          />

          <KnobControl
            label="Release"
            value={params.release}
            min={10}
            max={1000}
            step={10}
            unit="ms"
            onChange={(v) => setParams(p => ({ ...p, release: v }))}
            description="Zeit bis zum Loslassen nach dem Pegelabfall."
          />

          <KnobControl
            label="Makeup Gain"
            value={params.makeupGain}
            min={0}
            max={24}
            step={0.5}
            unit="dB"
            onChange={(v) => setParams(p => ({ ...p, makeupGain: v }))}
            description="Pegelaufholung nach der Kompression."
          />

          {/* NEW LIMIT CONTROL (Replaces Disco) */}
          <KnobControl
            label="Limit"
            value={limitThreshold}
            min={-24}
            max={0}
            step={0.5}
            unit="dB"
            onChange={(v) => setLimitThreshold(v)}
            description="Visuelle Begrenzung des Ausgangspegels (nur Kennlinie)."
          />

        </section>
      </div>
    </div>
  );
};

export default App;