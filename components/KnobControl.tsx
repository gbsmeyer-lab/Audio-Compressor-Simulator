import React from 'react';

interface KnobControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  description?: string;
}

const KnobControl: React.FC<KnobControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  description
}) => {
  return (
    <div className="flex flex-col gap-1 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm group hover:border-slate-600 transition-colors">
      <div className="flex justify-between items-end mb-0.5">
        <label className="text-slate-300 font-bold text-[10px] uppercase tracking-wider">{label}</label>
        <span className="text-cyan-400 font-mono text-[10px] sm:text-xs bg-slate-900 px-1.5 py-0 rounded border border-slate-800 min-w-[45px] text-right">
          {value} <span className="text-[8px] text-slate-500">{unit}</span>
        </span>
      </div>
      
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      />
      
      {description && (
        <p className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 h-5 leading-tight overflow-hidden text-ellipsis">
          {description}
        </p>
      )}
    </div>
  );
};

export default KnobControl;