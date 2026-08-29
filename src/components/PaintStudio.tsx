import React from 'react';
import { FilamentColor, BrickInstance } from '../types/brick';
import { BAMBU_FILAMENTS } from '../constants/filaments';
import { Palette, PaintBucket, Brush, Layers, Wand2, Check } from 'lucide-react';

interface PaintStudioProps {
  selectedColor: FilamentColor;
  setSelectedColor: (color: FilamentColor) => void;
  paintTool: 'brush' | 'bucket' | 'layer' | 'all';
  setPaintTool: (tool: 'brush' | 'bucket' | 'layer' | 'all') => void;
  onApplyGradient: () => void;
  onPaintAll: (color: FilamentColor) => void;
  onPaintLayer: (layerIndex: number, color: FilamentColor) => void;
  totalBricks: number;
  activeLayer: number;
  maxLayer: number;
}

export const PaintStudio: React.FC<PaintStudioProps> = ({
  selectedColor,
  setSelectedColor,
  paintTool,
  setPaintTool,
  onApplyGradient,
  onPaintAll,
  onPaintLayer,
  totalBricks,
  activeLayer,
  maxLayer,
}) => {
  const [customHex, setCustomHex] = React.useState(selectedColor.hex);

  const handleCustomHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setSelectedColor({
        id: `custom_${val.replace('#', '')}`,
        name: `Personalizado (${val})`,
        hex: val,
        type: 'Custom',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <Palette className="w-4 h-4 text-blue-400" />
          <span>Color & Filamentos Studio</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Asigna colores y filamentos compatibles con el AMS de BambuStudio y OrcaSlicer.
        </p>
      </div>

      {/* Paint Tools Mode */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block">Herramienta de Pintura</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaintTool('brush')}
            className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center space-x-2 transition ${
              paintTool === 'brush'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Brush className="w-3.5 h-3.5 text-blue-400" />
            <span>Pincel Pieza</span>
          </button>
          <button
            type="button"
            onClick={() => setPaintTool('bucket')}
            className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center space-x-2 transition ${
              paintTool === 'bucket'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <PaintBucket className="w-3.5 h-3.5 text-cyan-400" />
            <span>Relleno de Color</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPaintTool('layer');
              onPaintLayer(activeLayer, selectedColor);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center space-x-2 transition ${
              paintTool === 'layer'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pintar Capa</span>
          </button>
          <button
            type="button"
            onClick={() => onPaintAll(selectedColor)}
            className="py-2 px-3 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-800 flex items-center space-x-2 transition"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Pintar Todo</span>
          </button>
        </div>
      </div>

      {/* Bambu / Orca Filament Palette */}
      <div className="space-y-2.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-slate-300">Paleta Oficial Bambu / Orca</label>
          <span className="text-[10px] text-slate-400 font-mono">AMS Compatible</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {BAMBU_FILAMENTS.map((fil) => {
            const isSelected = selectedColor.hex.toLowerCase() === fil.hex.toLowerCase();

            return (
              <button
                key={fil.id}
                type="button"
                onClick={() => setSelectedColor(fil)}
                title={`${fil.name} (Ranura AMS #${fil.bambuSlot})`}
                className={`relative group h-9 rounded-lg border flex items-center justify-center transition ${
                  isSelected
                    ? 'border-white ring-2 ring-blue-500 scale-105 z-10 shadow-md'
                    : 'border-slate-700/80 hover:border-slate-500'
                }`}
                style={{ backgroundColor: fil.hex }}
              >
                {isSelected && (
                  <Check className={`w-4 h-4 ${isLightColor(fil.hex) ? 'text-black' : 'text-white'}`} />
                )}
                <span className="absolute bottom-full mb-1 hidden group-hover:block px-2 py-1 bg-slate-900 text-white text-[10px] rounded shadow-lg whitespace-nowrap z-30">
                  {fil.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Color Info */}
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span
              className="w-4 h-4 rounded-full border border-white/30"
              style={{ backgroundColor: selectedColor.hex }}
            />
            <span className="font-semibold text-slate-200">{selectedColor.name}</span>
          </div>
          <input
            type="color"
            value={selectedColor.hex}
            onChange={(e) => {
              const hex = e.target.value;
              setSelectedColor({
                id: `custom_${hex.replace('#', '')}`,
                name: `Personalizado (${hex})`,
                hex,
                type: 'Custom',
              });
            }}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
          />
        </div>
      </div>

      {/* Auto Gradient Preset */}
      <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block mb-1.5">Efectos Especiales</label>
        <button
          type="button"
          onClick={onApplyGradient}
          className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center space-x-2 transition"
        >
          <span className="text-base">🌈</span>
          <span>Aplicar Gradiente de Altura Multicolor</span>
        </button>
      </div>
    </div>
  );
};

function isLightColor(hex: string): boolean {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  // Perceived brightness formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140;
}
