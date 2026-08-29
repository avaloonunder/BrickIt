import React from 'react';
import { VoxelizerSettings } from '../types/brick';
import { Layers, Sliders, Box, Check, RefreshCw } from 'lucide-react';

interface VoxelizerControlsProps {
  settings: VoxelizerSettings;
  setSettings: React.Dispatch<React.SetStateAction<VoxelizerSettings>>;
  onVoxelize: () => void;
  isProcessing: boolean;
  modelDimensions?: { x: number; y: number; z: number };
}

export const VoxelizerControls: React.FC<VoxelizerControlsProps> = ({
  settings,
  setSettings,
  onVoxelize,
  isProcessing,
  modelDimensions,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Configuración de Voxelizado</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Ajusta la resolución de la cuadrícula y el tamaño de las piezas modulares.
        </p>
      </div>

      {/* Target Resolution Slider */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex justify-between text-xs">
          <span className="font-medium text-slate-300">Resolución de Cuadrícula</span>
          <span className="font-mono text-blue-400 font-bold">{settings.targetResolution} bloques máx</span>
        </div>
        <input
          type="range"
          min="10"
          max="50"
          step="2"
          value={settings.targetResolution}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, targetResolution: parseInt(e.target.value) }))
          }
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Rápido (10)</span>
          <span>Equilibrado (24)</span>
          <span>Alto Detalle (50)</span>
        </div>
      </div>

      {/* Fill Mode */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block">Modo de Relleno Interior</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, fillMode: 'solid' }))}
            className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition ${
              settings.fillMode === 'solid'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-blue-400" />
            <span>Sólido Completo</span>
          </button>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, fillMode: 'shell' }))}
            className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition ${
              settings.fillMode === 'shell'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Carcasa Hueca</span>
          </button>
        </div>
      </div>

      {/* Pitch dimensions */}
      <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs">
        <div>
          <span className="text-slate-400 block mb-1">Paso Modular XY</span>
          <div className="font-mono text-white font-semibold">{settings.pitchMm} mm</div>
          <span className="text-[10px] text-slate-500">Estándar modular</span>
        </div>
        <div>
          <span className="text-slate-400 block mb-1">Altura de Bloque Z</span>
          <div className="font-mono text-white font-semibold">{settings.heightMm} mm</div>
          <span className="text-[10px] text-slate-500">Proporción 6:5</span>
        </div>
      </div>

      {/* Run Action */}
      <button
        onClick={onVoxelize}
        disabled={isProcessing}
        className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
        <span>{isProcessing ? 'Voxelizando modelo 3D...' : 'Voxelizar Modelo 3D'}</span>
      </button>
    </div>
  );
};
