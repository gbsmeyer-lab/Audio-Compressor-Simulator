import React, { useEffect, useRef } from 'react';
import { ProcessedAudioData } from '../types';

interface VisualizerProps {
  data: ProcessedAudioData | null;
  threshold: number; 
  isPlaying: boolean;
  audioContext: AudioContext | null;
  syncTimeRef: React.MutableRefObject<number>; // The context time when the loop started
  showInputOverlay: boolean;
  isDiscoMode: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  data, 
  threshold, 
  isPlaying, 
  audioContext,
  syncTimeRef,
  showInputOverlay,
  isDiscoMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Main Draw Loop
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // 0. Calculate Playback Position synchronously
    let playbackProgress = 0;
    if (isPlaying && audioContext) {
        const now = audioContext.currentTime;
        
        // Attempt to compensate for output latency if available
        // This helps align the visual cursor with what is actually heard
        // @ts-ignore - outputLatency is experimental but useful here
        const sysLatency = (audioContext as any).outputLatency || (audioContext as any).baseLatency || 0;
        
        // Manual offset adjusted to reduce delay by 400ms (0.22 - 0.4 = -0.18)
        const manualOffset = -0.18; 
        const totalLatency = sysLatency + manualOffset;
        
        // We subtract latency because "now" is scheduling time. 
        // The sound you hear NOW was scheduled "latency" seconds ago.
        // So the visual cursor should be at (now - latency).
        const adjustedNow = now - totalLatency;

        const duration = data.duration;
        const syncTime = syncTimeRef.current;

        // Calculate elapsed time since sync anchor
        const elapsed = (adjustedNow - syncTime) % duration;
        
        // Safe-guard against negative modulo if time wraps oddly or clock drifts slightly on start
        const validElapsed = elapsed < 0 ? elapsed + duration : elapsed;
        playbackProgress = validElapsed / duration;
    }
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // --- DISCO BACKGROUND EFFECT ---
    if (isDiscoMode) {
      const time = Date.now() / 1000;
      ctx.save();
      // Draw some random laser beams
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 3;
      
      for (let i = 0; i < 8; i++) {
        const hue = (time * 50 + i * 45) % 360;
        ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.3)`;
        ctx.beginPath();
        // Lasers originating from different spots at the bottom
        const originX = (width / 8) * i + (width/16);
        const originY = height;
        
        // Endpoint swaying
        const destX = width / 2 + Math.sin(time * 2 + i) * width;
        const destY = 0;
        
        ctx.moveTo(originX, originY);
        ctx.lineTo(destX, destY);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Background Grid
    ctx.strokeStyle = isDiscoMode ? '#334155' : '#1e293b'; // Slightly brighter grid in disco
    ctx.lineWidth = 1;
    ctx.beginPath();
    const drawDbLine = (db: number) => {
        const amp = Math.pow(10, db / 20);
        const yTop = centerY - (amp * centerY * 0.9); // 0.9 padding
        const yBot = centerY + (amp * centerY * 0.9);
        ctx.moveTo(0, yTop); ctx.lineTo(width, yTop);
        ctx.moveTo(0, yBot); ctx.lineTo(width, yBot);
    };
    [-6, -12, -24, -36].forEach(drawDbLine);
    ctx.stroke();

    const bufferLength = data.inputBuffer.length;
    const step = Math.ceil(bufferLength / width); // Downsampling for drawing

    // 1. Draw Output
    // In disco mode, cycle colors
    ctx.beginPath();
    if (isDiscoMode) {
        const hue = (Date.now() / 10) % 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
    } else {
        ctx.strokeStyle = '#22d3ee'; // cyan-400
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
    }
    
    for (let x = 0; x < width; x++) {
      const i = x * step;
      if (i >= bufferLength) break;
      const amp = data.outputBuffer[i];
      const y = centerY + (amp * centerY * 0.9 * -1);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Reset shadow for other elements
    ctx.shadowBlur = 0;

    // 2. Draw Input Overlay (Orange) - on top
    if (showInputOverlay) {
        ctx.beginPath();
        ctx.strokeStyle = '#f97316'; // orange-500
        ctx.lineWidth = 4; 
        for (let x = 0; x < width; x++) {
          const i = x * step;
          if (i >= bufferLength) break;
          const amp = data.inputBuffer[i];
          const y = centerY + (amp * centerY * 0.9 * -1);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // 3. Draw Threshold Line
    const threshAmp = Math.pow(10, threshold / 20);
    const threshYTop = centerY - (threshAmp * centerY * 0.9);
    const threshYBot = centerY + (threshAmp * centerY * 0.9);
    
    ctx.beginPath();
    ctx.strokeStyle = isDiscoMode ? '#ffffff' : '#f472b6'; // pink-400 or white
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, threshYTop); ctx.lineTo(width, threshYTop);
    ctx.moveTo(0, threshYBot); ctx.lineTo(width, threshYBot);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Draw Gain Reduction (Red fill from top)
    if (isDiscoMode) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // White flashes in disco
    } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    }
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x < width; x++) {
        const i = x * step;
        if (i >= bufferLength) break;
        const grLinear = data.gainReductionBuffer[i];
        const grDb = 20 * Math.log10(grLinear);
        const drawHeight = Math.min(Math.abs(grDb) * 5, 100); 
        ctx.lineTo(x, drawHeight);
    }
    ctx.lineTo(width, 0);
    ctx.fill();

    // 5. Playhead
    if (isPlaying) {
        const playX = playbackProgress * width;
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.moveTo(playX, 0);
        ctx.lineTo(playX, height);
        ctx.stroke();
    }

    // Schedule next frame
    animationRef.current = requestAnimationFrame(draw);
  };

  // Lifecycle management for the animation loop
  useEffect(() => {
    // Start Loop
    animationRef.current = requestAnimationFrame(draw);
    
    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [data, threshold, isPlaying, showInputOverlay, audioContext, isDiscoMode]); // added isDiscoMode

  return (
    <div className={`relative w-full bg-slate-950 rounded-xl border overflow-hidden shadow-inner transition-colors duration-500 ${isDiscoMode ? 'border-fuchsia-500 shadow-[0_0_30px_rgba(217,70,239,0.3)]' : 'border-slate-800'}`}>
      <canvas 
        ref={canvasRef}
        width={1200} 
        height={300} 
        className="w-full h-64 object-cover block"
      />
      
      {/* Legend Overlay */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 text-xs bg-slate-900/80 p-2 rounded border border-slate-700 backdrop-blur-sm pointer-events-none">
        {showInputOverlay && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <span className="text-orange-400">Original Input</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isDiscoMode ? 'animate-pulse bg-white' : 'bg-cyan-400'}`}></span>
          <span className={isDiscoMode ? 'text-white font-bold' : 'text-cyan-400 font-bold'}>Compressed Output</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-pink-400"></span>
          <span className="text-pink-400">Threshold</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500"></span>
          <span className="text-red-400">Gain Reduction</span>
        </div>
      </div>
    </div>
  );
};

export default Visualizer;