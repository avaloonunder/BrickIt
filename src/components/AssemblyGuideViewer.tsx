import React, { useState, useEffect, useRef } from 'react';
import { AssemblyStep, ModelStatistics } from '../types/brick';
import { generateAssemblyGuidePDF } from '../exporters/pdfGuideGenerator';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Layers,
  Sparkles,
  CheckCircle2,
  Maximize,
  Sliders,
} from 'lucide-react';

interface AssemblyGuideViewerProps {
  steps: AssemblyStep[];
  currentStepIndex: number;
  setCurrentStepIndex: React.Dispatch<React.SetStateAction<number>>;
  statistics: ModelStatistics | null;
  projectName: string;
  onCaptureSnapshot: () => string;
  explodeFactor: number;
  setExplodeFactor: (val: number) => void;
}

export const AssemblyGuideViewer: React.FC<AssemblyGuideViewerProps> = ({
  steps,
  currentStepIndex,
  setCurrentStepIndex,
  statistics,
  projectName,
  onCaptureSnapshot,
  explodeFactor,
  setExplodeFactor,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<string>('');

  const currentStep = steps[currentStepIndex - 1] || steps[0];
  const totalSteps = steps.length;

  // Auto-play interval
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= totalSteps) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalSteps, setCurrentStepIndex]);

  // Handle PDF Generation
  const handleDownloadPDF = async () => {
    if (!statistics) return;
    setIsGeneratingPdf(true);
    setPdfProgress('Preparando capturas 3D del modelo...');

    try {
      // 1. Capture cover image
      const coverImage = onCaptureSnapshot();

      // 2. Generate PDF
      setPdfProgress('Compilando páginas del manual de montaje...');
      const pdfBlob = await generateAssemblyGuidePDF({
        projectName: projectName || 'Modelo 3D Modular',
        statistics,
        steps,
        modelImageBase64: coverImage || undefined,
      });

      // 3. Trigger Download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Guia_Montaje_${projectName.replace(/\s+/g, '_')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      // Celebration Confetti!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress('');
    }
  };

  if (!currentStep) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs">
        No hay pasos de montaje disponibles.
      </div>
    );
  }

  // Group current step bricks by morphology and color
  const partGroups = new Map<string, { morphId: string; colorHex: string; count: number }>();
  currentStep.bricksAdded.forEach((b) => {
    const key = `${b.morphologyId}_${b.color.hex}`;
    if (!partGroups.has(key)) {
      partGroups.set(key, {
        morphId: b.morphologyId,
        colorHex: b.color.hex,
        count: 0,
      });
    }
    partGroups.get(key)!.count++;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <Play className="w-4 h-4 text-blue-400" />
          <span>Guía Visual de Montaje Paso a Paso</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Visualiza el orden constructivo por capas y descarga el manual técnico en PDF.
        </p>
      </div>

      {/* Step Navigator Bar */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
              Paso {currentStepIndex} de {totalSteps}
            </div>
            <div className="text-sm font-bold text-white">
              Capa {currentStep.layerIndex + 1} ({currentStep.bricksAdded.length} piezas)
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <div>Colocadas: <span className="font-bold text-white">{currentStep.totalBricksSoFar}</span></div>
          </div>
        </div>

        {/* Step Slider */}
        <input
          type="range"
          min="1"
          max={totalSteps}
          value={currentStepIndex}
          onChange={(e) => setCurrentStepIndex(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />

        {/* Play / Next / Prev Controls */}
        <div className="flex items-center justify-center space-x-2 pt-1">
          <button
            onClick={() => setCurrentStepIndex(Math.max(1, currentStepIndex - 1))}
            disabled={currentStepIndex <= 1}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
          </button>

          <button
            onClick={() => setCurrentStepIndex(Math.min(totalSteps, currentStepIndex + 1))}
            disabled={currentStepIndex >= totalSteps}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Parts Required for this step */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Piezas Necesarias para este Paso</span>
        </label>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {Array.from(partGroups.values()).map((group, idx) => (
            <div
              key={idx}
              className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
                  style={{ backgroundColor: group.colorHex }}
                />
                <span className="font-semibold text-white">{group.morphId}</span>
              </div>
              <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                × {group.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exploded View Slider */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex justify-between text-xs">
          <span className="font-medium text-slate-300 flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Vista Explosionada (Despiece)</span>
          </span>
          <span className="font-mono text-indigo-400">{Math.round(explodeFactor * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1.5"
          step="0.05"
          value={explodeFactor}
          onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* Download PDF Manual Button */}
      <button
        onClick={handleDownloadPDF}
        disabled={isGeneratingPdf}
        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
      >
        <FileDown className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
        <span>{isGeneratingPdf ? pdfProgress || 'Generando PDF...' : 'Descargar Guía de Montaje en PDF'}</span>
      </button>
    </div>
  );
};
