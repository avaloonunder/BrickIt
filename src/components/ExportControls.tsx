import React, { useState } from 'react';
import { BrickInstance, SlicerExportSettings, ModelStatistics } from '../types/brick';
import { exportTo3MF } from '../exporters/3mfExporter';
import { exportToSTLZip } from '../exporters/stlExporter';
import confetti from 'canvas-confetti';
import {
  FileDown,
  Printer,
  Sparkles,
  Sliders,
  CheckCircle,
  HelpCircle,
  PackageCheck,
  ExternalLink,
} from 'lucide-react';

interface ExportControlsProps {
  bricks: BrickInstance[];
  statistics: ModelStatistics | null;
  projectName: string;
}

export const ExportControls: React.FC<ExportControlsProps> = ({
  bricks,
  statistics,
  projectName,
}) => {
  const [settings, setSettings] = useState<SlicerExportSettings>({
    targetSlicer: 'bambu',
    exportMode: 'assembled',
    bedSizeX: 256,
    bedSizeY: 256,
    bedSpacing: 4.0,
    toleranceOffsetMm: 0.15,
    embossLabels: false,
  });

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const handleExport3MF = async () => {
    setIsExporting(true);
    try {
      const blob = await exportTo3MF(bricks, settings, projectName || 'BrickCraft_Model');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const suffix = settings.exportMode === 'plate_nested' ? 'Placas_Impresion' : 'Ensamblado';
      link.download = `${(projectName || 'Modelo_Modular').replace(/\s+/g, '_')}_${suffix}_BambuOrca.3mf`;
      link.click();
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('Error exporting 3MF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSTL = async () => {
    setIsExporting(true);
    try {
      const blob = await exportToSTLZip(bricks, projectName || 'BrickCraft_Model');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(projectName || 'Modelo_Modular').replace(/\s+/g, '_')}_STLs.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting STLs:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <Printer className="w-4 h-4 text-blue-400" />
          <span>Exportación 3MF para BambuStudio & OrcaSlicer</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Exporta el modelo con información de color multicolor y compatibilidad nativa con AMS.
        </p>
      </div>

      {/* Target Slicer Selection */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block">Software Slicer Destino</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, targetSlicer: 'bambu' }))}
            className={`py-2.5 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-2 transition ${
              settings.targetSlicer === 'bambu'
                ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>BambuStudio</span>
          </button>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, targetSlicer: 'orca' }))}
            className={`py-2.5 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-2 transition ${
              settings.targetSlicer === 'orca'
                ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-sm'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>OrcaSlicer</span>
          </button>
        </div>
      </div>

      {/* Export Mode Selection */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block">Disposición de las Piezas</label>
        <div className="space-y-2">
          <div
            onClick={() => setSettings((prev) => ({ ...prev, exportMode: 'assembled' }))}
            className={`p-3 rounded-lg cursor-pointer border text-xs transition ${
              settings.exportMode === 'assembled'
                ? 'bg-blue-600/20 border-blue-500 text-white'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <div className="font-semibold text-slate-200">Modelo Ensamblado Completo (.3mf)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Todas las piezas en posición 3D final con colores mapeados a los extrusores del slicer.
            </div>
          </div>

          <div
            onClick={() => setSettings((prev) => ({ ...prev, exportMode: 'plate_nested' }))}
            className={`p-3 rounded-lg cursor-pointer border text-xs transition ${
              settings.exportMode === 'plate_nested'
                ? 'bg-blue-600/20 border-blue-500 text-white'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <div className="font-semibold text-slate-200">Piezas Aplanadas en Cama de Impresión (.3mf)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Organiza los bloques planos en la bandeja (256×256 mm) para imprimir sin soportes.
            </div>
          </div>
        </div>
      </div>

      {/* Printing Tolerance Clearance */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex justify-between text-xs">
          <span className="font-medium text-slate-300 flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Tolerancia de Encaje (Holgura)</span>
          </span>
          <span className="font-mono text-blue-400 font-bold">{settings.toleranceOffsetMm} mm</span>
        </div>
        <input
          type="range"
          min="0.10"
          max="0.30"
          step="0.01"
          value={settings.toleranceOffsetMm}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, toleranceOffsetMm: parseFloat(e.target.value) }))
          }
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Ajustado (0.10mm)</span>
          <span>Recomendado FDM (0.15mm)</span>
          <span>Holgado (0.30mm)</span>
        </div>
      </div>

      {/* Main Export 3MF Button */}
      <button
        onClick={handleExport3MF}
        disabled={isExporting}
        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
      >
        <PackageCheck className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
        <span>{isExporting ? 'Generando archivo 3MF...' : 'Descargar 3MF para Bambu / Orca'}</span>
      </button>

      {/* Alternative STL Export */}
      <button
        type="button"
        onClick={handleExportSTL}
        disabled={isExporting}
        className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center justify-center space-x-2 transition"
      >
        <FileDown className="w-3.5 h-3.5 text-slate-400" />
        <span>Descargar Archivos STL (.zip)</span>
      </button>

      {/* How to import into BambuStudio instructions banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
        <div className="font-semibold text-blue-400 flex items-center space-x-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Cómo abrir en BambuStudio / OrcaSlicer:</span>
        </div>
        <ol className="list-decimal list-inside text-slate-300 space-y-1 text-[11px] pl-1">
          <li>Abre BambuStudio u OrcaSlicer.</li>
          <li>Arrastra el archivo <span className="font-mono text-cyan-300">.3mf</span> o ve a <span className="font-semibold text-white">Archivo → Importar → Importar modelos 3D</span>.</li>
          <li>Los colores se asignarán automáticamente a tus ranuras de filamento (AMS).</li>
          <li>¡Haz clic en <span className="font-semibold text-white">Laminar (Slice)</span> e imprime!</li>
        </ol>
      </div>
    </div>
  );
};
