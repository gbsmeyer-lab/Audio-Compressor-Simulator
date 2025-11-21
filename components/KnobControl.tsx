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
    <div className="flex flex-col gap-2 bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-md group hover:border-slate-600 transition-colors">
      <div className="flex justify-between items-center mb-1">
        <label className="text-slate-300 font-bold text-sm uppercase tracking-wider">{label}</label>
        <span className="text-cyan-400 font-mono text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-800 min-w-[60px] text-right">
          {value} <span className="text-xs text-slate-500">{unit}</span>
        </span>
      </div>
      
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      />
      
      {description && (
        <p className="text-xs text-slate-500 mt-1 h-8 leading-tight">
          {description}
        </p>
      )}
    </div>
  );
};

export default KnobControl;