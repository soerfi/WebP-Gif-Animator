import React from 'react';
import { Preset } from '../types';
import * as Icons from 'lucide-react';

interface PresetSelectorProps {
  presets: Preset[];
  selectedId: string | null;
  onSelect: (preset: Preset) => void;
  disabled: boolean;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ 
  presets, 
  selectedId, 
  onSelect,
  disabled 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {presets.map((preset) => {
        // Dynamic icon rendering
        const IconComponent = (Icons as any)[preset.icon] || Icons.HelpCircle;
        const isSelected = selectedId === preset.id;

        return (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            disabled={disabled}
            className={`
              relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all h-full
              ${isSelected 
                ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-sm' 
                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className={`
              p-2.5 rounded-lg mb-3
              ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600'}
            `}>
              <IconComponent size={20} />
            </div>
            <div>
              <h3 className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                {preset.label}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {preset.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};