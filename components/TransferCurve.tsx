import React, { useEffect, useRef } from 'react';

interface TransferCurveProps {
  threshold: number;
  ratio: number;
  makeupGain: number;
  limitThreshold: number; // New prop for the visual limiter
}

const TransferCurve: React.FC<TransferCurveProps> = ({ threshold, ratio, makeupGain, limitThreshold }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Increased padding to make room for labels
    const padding = 40; 
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = '#0f172a'; // slate-950
    ctx.fillRect(0, 0, width, height);

    // Helper: Map dB (-60 to 0) to Pixel Coordinates
    const minDb = -60;
    const maxDb = 0;
    const dbRange = maxDb - minDb;

    const dbToX = (db: number) => {
      const clamped = Math.max(minDb, Math.min(maxDb, db));
      const norm = (clamped - minDb) / dbRange;
      return padding + norm * graphWidth;
    };

    const dbToY = (db: number) => {
      // Visual clamping for Y so lines don't fly off canvas
      // But we allow drawing slightly outside range to show clipping
      const norm = (db - minDb) / dbRange;
      return height - padding - (norm * graphHeight); // Y is inverted
    };

    // --- GRID & AXIS ---
    ctx.strokeStyle = '#334155'; // brighter slate for grid
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Vertical lines (Input)
    for (let db = minDb; db <= maxDb; db += 10) {
      const x = dbToX(db);
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      
      // Labels - WHITE / BRIGHT
      if (db !== minDb) {
        ctx.fillStyle = '#ffffff'; 
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        // Draw numbers slightly below the axis line
        ctx.fillText(db.toString(), x, height - padding + 15);
      }
    }

    // Horizontal lines (Output)
    for (let db = minDb; db <= maxDb; db += 10) {
      const y = dbToY(db);
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);

      // Labels - WHITE / BRIGHT
      if (db !== minDb) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(db.toString(), padding - 8, y + 3);
      }
    }
    ctx.stroke();

    // Axis Titles - WHITE / BRIGHT
    ctx.save();
    ctx.fillStyle = '#ffffff'; 
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    // Position X Axis Title at the very bottom
    ctx.fillText("INPUT (dB)", width / 2, height - 5);
    
    // Position Y Axis Title
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("OUTPUT (dB)", 0, 0);
    ctx.restore();


    // --- REFERENCE LINE (1:1 Unity Gain) ---
    ctx.beginPath();
    ctx.strokeStyle = '#475569'; 
    ctx.setLineDash([4, 4]);
    ctx.moveTo(dbToX(minDb), dbToY(minDb));
    ctx.lineTo(dbToX(maxDb), dbToY(maxDb));
    ctx.stroke();
    ctx.setLineDash([]);


    // --- COMPRESSOR + LIMITER CURVE ---
    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee'; // cyan-400
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(34, 211, 238, 0.3)';

    // Start point logic
    const startInDb = minDb;
    let startOutDb = startInDb > threshold 
      ? threshold + ((startInDb - threshold) / ratio) 
      : startInDb;
    startOutDb += makeupGain;
    startOutDb = Math.min(startOutDb, limitThreshold); // Apply Limit

    ctx.moveTo(dbToX(startInDb), dbToY(startOutDb));

    // Iterate through points to draw the line
    for (let inDb = minDb; inDb <= maxDb; inDb += 0.5) {
      let outDb = inDb;
      
      // Apply Compression math
      if (inDb > threshold) {
        const over = inDb - threshold;
        outDb = threshold + (over / ratio);
      }
      
      outDb += makeupGain;
      
      // Apply Limiter Logic (Visual only)
      outDb = Math.min(outDb, limitThreshold);

      ctx.lineTo(dbToX(inDb), dbToY(outDb));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;


    // --- LIMIT LINE VISUALIZATION (If active) ---
    if (limitThreshold < 0) {
        const limitY = dbToY(limitThreshold);
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444'; // Red
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.moveTo(padding, limitY);
        ctx.lineTo(width - padding, limitY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = '9px monospace';
        // Position text slightly above the red line
        ctx.fillText("LIMIT", width - padding - 25, limitY - 4);
    }

    // --- THRESHOLD POINT ---
    // We calculate where the threshold actually sits on the output curve
    let kneeOutDb = threshold + makeupGain;
    kneeOutDb = Math.min(kneeOutDb, limitThreshold); // Clamp knee if limit is below threshold (unlikely but possible)

    const kneeInputX = dbToX(threshold);
    const kneeOutputY = dbToY(kneeOutDb);
    
    ctx.beginPath();
    ctx.fillStyle = '#f472b6'; // pink-400
    ctx.arc(kneeInputX, kneeOutputY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Threshold Vertical Line
    ctx.beginPath();
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.moveTo(kneeInputX, kneeOutputY);
    ctx.lineTo(kneeInputX, height - padding); // Drop to X axis line
    ctx.stroke();
    ctx.globalAlpha = 1.0;

  }, [threshold, ratio, makeupGain, limitThreshold]);

  return (
    <div className="w-full h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner flex flex-col">
      <div className="bg-slate-900/80 px-3 py-2 border-b border-slate-800 text-xs font-bold text-slate-300 uppercase tracking-wider">
        Kennlinie (Transfer)
      </div>
      <div className="flex-grow relative">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="w-full h-full object-contain block"
        />
      </div>
    </div>
  );
};

export default TransferCurve;