import React, { useState } from 'react';
import { BrickInstance, ModelStatistics } from '../types/brick';
import { BRICK_CATALOG } from '../constants/brickCatalog';
import { Box, FileSpreadsheet, Download, Hash, Layers, Weight, Ruler } from 'lucide-react';

interface CatalogBOMProps {
  statistics: ModelStatistics | null;
  bricks: BrickInstance[];
  showNumbers: boolean;
  setShowNumbers: (val: boolean) => void;
}

export const CatalogBOM: React.FC<CatalogBOMProps> = ({
  statistics,
  bricks,
  showNumbers,
  setShowNumbers,
}) => {
  const [filterColor, setFilterColor] = useState<string | 'all'>('all');

  if (!statistics) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs">
        No hay datos de catálogo. Optimiza un modelo primero.
      </div>
    );
  }

  const catalogMap = new Map(BRICK_CATALOG.map((c) => [c.id, c]));

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'Codigo_Morfologia,Nombre_Bloque,Studs,Dimensiones_mm,Cantidad,Peso_Estimado_g\n';
    Object.entries(statistics.morphologyCounts).forEach(([morphId, count]) => {
      const morph = catalogMap.get(morphId);
      const name = morph ? morph.name : morphId;
      const studs = morph ? `${morph.width}x${morph.length}` : '-';
      const dims = morph ? `${morph.width * 8}x${morph.length * 8}x9.6` : '-';
      const weightEach = morph ? morph.width * morph.length * 0.75 : 1.0;
      const subtotalWeight = (weightEach * count).toFixed(1);

      csv += `"${morphId}","${name}","${studs}","${dims}",${count},${subtotalWeight}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Catalogo_Piezas_BOM.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export JSON
  const handleExportJSON = () => {
    const data = {
      project: 'BrickCraft 3D Modular Model',
      statistics,
      inventory: Object.entries(statistics.morphologyCounts).map(([morphId, count]) => {
        const morph = catalogMap.get(morphId);
        return {
          id: morphId,
          name: morph?.name,
          studs: morph?.studCount,
          count,
        };
      }),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Catalogo_Piezas_BOM.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <Box className="w-4 h-4 text-blue-400" />
          <span>Catálogo de Piezas & Lista de Materiales (BOM)</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Inventario catalogado por morfología para el ensamblaje y preparación de impresión.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Total Bloques</span>
            <span className="text-base font-bold text-white">{statistics.totalBricks}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Weight className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Peso Total</span>
            <span className="text-base font-bold text-emerald-400">{statistics.estimatedWeightGrams} g</span>
          </div>
        </div>

        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Capas / Niveles</span>
            <span className="text-base font-bold text-white">{statistics.layerCount}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Dimensiones</span>
            <span className="text-[11px] font-bold text-white">
              {Math.round(statistics.dimensionsMm.x)}×{Math.round(statistics.dimensionsMm.y)}×{Math.round(statistics.dimensionsMm.z)} mm
            </span>
          </div>
        </div>
      </div>

      {/* Morphology Breakdown List */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block mb-2">Desglose de Morfologías</label>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {Object.entries(statistics.morphologyCounts).map(([morphId, count]) => {
            const morph = catalogMap.get(morphId);
            const percentage = Math.round((count / statistics.totalBricks) * 100);

            return (
              <div
                key={morphId}
                className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/70 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded bg-blue-600/20 text-blue-400 font-mono text-[10px] font-bold flex items-center justify-center border border-blue-500/30">
                    {morphId.replace('MB-', '')}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{morph?.name || morphId}</div>
                    <div className="text-[10px] text-slate-400">
                      {morph?.width}×{morph?.length} studs ({morph?.width ? morph.width * 8 : '-'}×{morph?.length ? morph.length * 8 : '-'} mm)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-white">{count} uds</div>
                  <div className="text-[10px] text-blue-400">{percentage}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Color Distribution */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block mb-2">Distribución de Colores</label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(statistics.colorCounts).map(([hex, count]) => (
            <div
              key={hex}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs"
            >
              <span className="w-3 h-3 rounded-full border border-white/40" style={{ backgroundColor: hex }} />
              <span className="font-mono text-slate-200">{count} uds</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export BOM Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExportCSV}
          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center space-x-2 transition"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Exportar CSV</span>
        </button>
        <button
          type="button"
          onClick={handleExportJSON}
          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center space-x-2 transition"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Exportar JSON</span>
        </button>
      </div>
    </div>
  );
};
