import React from 'react';
import { OptimizerSettings } from '../types/brick';
import { BRICK_CATALOG } from '../constants/brickCatalog';
import { Box, ShieldCheck, Cpu, RefreshCw, CheckSquare, Square } from 'lucide-react';

interface OptimizerControlsProps {
  settings: OptimizerSettings;
  setSettings: React.Dispatch<React.SetStateAction<OptimizerSettings>>;
  onOptimize: () => void;
  isProcessing: boolean;
}

export const OptimizerControls: React.FC<OptimizerControlsProps> = ({
  settings,
  setSettings,
  onOptimize,
  isProcessing,
}) => {
  const toggleMorphology = (id: string) => {
    setSettings((prev) => {
      const exists = prev.allowedMorphologies.includes(id);
      if (exists && prev.allowedMorphologies.length === 1) return prev; // Keep at least one

      const updated = exists
        ? prev.allowedMorphologies.filter((m) => m !== id)
        : [...prev.allowedMorphologies, id];
      return { ...prev, allowedMorphologies: updated };
    });
  };

  const selectAll = () => {
    setSettings((prev) => ({
      ...prev,
      allowedMorphologies: BRICK_CATALOG.map((m) => m.id),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <span>Optimización de Bloques Modulares</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Convierte vóxeles 1x1 en piezas compuestas con entrelazado estructural resistente.
        </p>
      </div>

      {/* Allowed Morphologies Library */}
      <div className="space-y-2.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-300">Catálogo de Piezas Permitidas</label>
          <button
            type="button"
            onClick={selectAll}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
          >
            Seleccionar todas
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
          {BRICK_CATALOG.map((morph) => {
            const isChecked = settings.allowedMorphologies.includes(morph.id);

            return (
              <div
                key={morph.id}
                onClick={() => toggleMorphology(morph.id)}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border text-xs transition ${
                  isChecked
                    ? 'bg-blue-600/20 border-blue-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold text-slate-200">{morph.name}</span>
                    <span className="text-[10px] text-slate-400 ml-2">
                      ({morph.width}×{morph.length} studs)
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-300 border border-slate-700">
                  {morph.id}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interlock Strength Preset */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Fuerza de Traba y Cruce de Capas</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['low', 'balanced', 'maximum'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSettings((prev) => ({ ...prev, interlockStrength: mode }))}
              className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition ${
                settings.interlockStrength === mode
                  ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {mode === 'low' && 'Básica'}
              {mode === 'balanced' && 'Equilibrada'}
              {mode === 'maximum' && 'Máxima'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          La orientación alterna (running bond) previene líneas de fractura vertical en el modelo físico.
        </p>
      </div>

      {/* Run Optimizer */}
      <button
        onClick={onOptimize}
        disabled={isProcessing}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
        <span>{isProcessing ? 'Calculando entrelazado...' : 'Generar Bloques Optimizados'}</span>
      </button>
    </div>
  );
};
