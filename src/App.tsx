import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  BrickInstance,
  VoxelGrid,
  FilamentColor,
  ModelStatistics,
  AssemblyStep,
  VoxelizerSettings,
  OptimizerSettings,
} from './types/brick';
import { DEFAULT_COLOR, BAMBU_FILAMENTS } from './constants/filaments';
import { BRICK_CATALOG } from './constants/brickCatalog';
import { parseSTL } from './core/stlParser';
import { SAMPLE_MODELS, SampleModel } from './core/sampleModels';
import { voxelizeGeometry } from './core/voxelizer';
import {
  optimizeVoxelGridToBricks,
  calculateModelStatistics,
  generateAssemblySteps,
} from './core/brickOptimizer';

import { Navbar } from './components/Navbar';
import { Viewport3D, Viewport3DHandle } from './components/Viewport3D';
import { VoxelizerControls } from './components/VoxelizerControls';
import { OptimizerControls } from './components/OptimizerControls';
import { PaintStudio } from './components/PaintStudio';
import { CatalogBOM } from './components/CatalogBOM';
import { AssemblyGuideViewer } from './components/AssemblyGuideViewer';
import { ExportControls } from './components/ExportControls';
import { Box, Sparkles, Layers, Sliders, Eye, FileText, ChevronRight } from 'lucide-react';

export const App: React.FC = () => {
  const viewportRef = useRef<Viewport3DHandle>(null);

  // Model & Processing State
  const [projectName, setProjectName] = useState<string>('Corazon_3D_Modular');
  const [originalGeometry, setOriginalGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [voxelGrid, setVoxelGrid] = useState<VoxelGrid | null>(null);
  const [bricks, setBricks] = useState<BrickInstance[]>([]);
  const [statistics, setStatistics] = useState<ModelStatistics | null>(null);
  const [steps, setSteps] = useState<AssemblyStep[]>([]);

  // UI Navigation & Controls State
  const [activeTab, setActiveTab] = useState<string>('voxelize');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Color & Paint State
  const [selectedColor, setSelectedColor] = useState<FilamentColor>(DEFAULT_COLOR);
  const [paintTool, setPaintTool] = useState<'brush' | 'bucket' | 'layer' | 'all'>('brush');

  // Visualization Options
  const [showOriginalMesh, setShowOriginalMesh] = useState<boolean>(false);
  const [showGridFloor, setShowGridFloor] = useState<boolean>(true);
  const [activeLayerFilter, setActiveLayerFilter] = useState<number | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(1);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [showNumbers, setShowNumbers] = useState<boolean>(false);

  // Settings
  const [voxelSettings, setVoxelSettings] = useState<VoxelizerSettings>({
    pitchMm: 8.0,
    heightMm: 9.6,
    targetResolution: 20,
    fillMode: 'solid',
    shellThickness: 2,
    autoCenter: true,
  });

  const [optimizerSettings, setOptimizerSettings] = useState<OptimizerSettings>({
    allowedMorphologies: BRICK_CATALOG.map((m) => m.id),
    interlockStrength: 'balanced',
    plateSupport: true,
    minInterlockOverlap: 1,
  });

  // Load initial demo model on startup
  useEffect(() => {
    loadSampleModel(SAMPLE_MODELS[0]); // Load Heart Sample
  }, []);

  // Handler: Load Sample Model
  const loadSampleModel = (sample: SampleModel) => {
    setIsProcessing(true);
    setProjectName(sample.name);
    try {
      const geo = sample.getGeometry();
      setOriginalGeometry(geo);

      // Automatically voxelize & optimize
      const vGrid = voxelizeGeometry(geo, voxelSettings);
      setVoxelGrid(vGrid);

      const generatedBricks = optimizeVoxelGridToBricks(vGrid, optimizerSettings, DEFAULT_COLOR);
      setBricks(generatedBricks);

      const stats = calculateModelStatistics(generatedBricks, vGrid);
      setStatistics(stats);

      const genSteps = generateAssemblySteps(generatedBricks);
      setSteps(genSteps);
      setCurrentStepIndex(genSteps.length > 0 ? 1 : 1);
    } catch (err) {
      console.error('Error loading sample model:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Upload STL File
  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    setProjectName(fileName);

    try {
      const buffer = await file.arrayBuffer();
      const geo = parseSTL(buffer);
      setOriginalGeometry(geo);

      // Voxelize
      const vGrid = voxelizeGeometry(geo, voxelSettings);
      setVoxelGrid(vGrid);

      // Optimize
      const generatedBricks = optimizeVoxelGridToBricks(vGrid, optimizerSettings, DEFAULT_COLOR);
      setBricks(generatedBricks);

      // Stats & Steps
      const stats = calculateModelStatistics(generatedBricks, vGrid);
      setStatistics(stats);

      const genSteps = generateAssemblySteps(generatedBricks);
      setSteps(genSteps);
      setCurrentStepIndex(1);
      setActiveTab('optimize');
    } catch (err) {
      console.error('Error parsing STL file:', err);
      alert('Hubo un error al procesar el archivo STL. Asegúrate de que sea un archivo STL válido.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Run Voxelization
  const handleRunVoxelization = () => {
    if (!originalGeometry) return;
    setIsProcessing(true);

    setTimeout(() => {
      try {
        const vGrid = voxelizeGeometry(originalGeometry, voxelSettings);
        setVoxelGrid(vGrid);

        const generatedBricks = optimizeVoxelGridToBricks(vGrid, optimizerSettings, selectedColor);
        setBricks(generatedBricks);

        const stats = calculateModelStatistics(generatedBricks, vGrid);
        setStatistics(stats);

        const genSteps = generateAssemblySteps(generatedBricks);
        setSteps(genSteps);
        setCurrentStepIndex(1);
        setActiveTab('optimize');
      } catch (err) {
        console.error('Error during voxelization:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Handler: Run Optimization
  const handleRunOptimization = () => {
    if (!voxelGrid) return;
    setIsProcessing(true);

    setTimeout(() => {
      try {
        const generatedBricks = optimizeVoxelGridToBricks(voxelGrid, optimizerSettings, selectedColor);
        setBricks(generatedBricks);

        const stats = calculateModelStatistics(generatedBricks, voxelGrid);
        setStatistics(stats);

        const genSteps = generateAssemblySteps(generatedBricks);
        setSteps(genSteps);
        setCurrentStepIndex(1);
        setActiveTab('paint');
      } catch (err) {
        console.error('Error during optimization:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Handler: Paint Single Brick
  const handleBrickColorChange = (brickId: string, color: FilamentColor) => {
    if (paintTool === 'brush') {
      setBricks((prev) =>
        prev.map((b) => (b.id === brickId ? { ...b, color } : b))
      );
    } else if (paintTool === 'bucket') {
      const targetBrick = bricks.find((b) => b.id === brickId);
      if (!targetBrick) return;
      const targetHex = targetBrick.color.hex;
      setBricks((prev) =>
        prev.map((b) => (b.color.hex === targetHex ? { ...b, color } : b))
      );
    }

    if (voxelGrid) {
      setTimeout(() => {
        setStatistics(calculateModelStatistics(bricks, voxelGrid));
      }, 50);
    }
  };

  // Handler: Paint Layer
  const handlePaintLayer = (layerIdx: number, color: FilamentColor) => {
    setBricks((prev) =>
      prev.map((b) => (b.layerIndex === layerIdx ? { ...b, color } : b))
    );
    if (voxelGrid) {
      setTimeout(() => {
        setStatistics(calculateModelStatistics(bricks, voxelGrid));
      }, 50);
    }
  };

  // Handler: Paint All
  const handlePaintAll = (color: FilamentColor) => {
    setBricks((prev) => prev.map((b) => ({ ...b, color })));
    if (voxelGrid) {
      setTimeout(() => {
        setStatistics(calculateModelStatistics(bricks, voxelGrid));
      }, 50);
    }
  };

  // Handler: Apply Rainbow Height Gradient
  const handleApplyGradient = () => {
    if (bricks.length === 0) return;
    const maxZ = Math.max(...bricks.map((b) => b.layerIndex));
    const palette = BAMBU_FILAMENTS;

    setBricks((prev) =>
      prev.map((b) => {
        const colorIdx = Math.floor((b.layerIndex / Math.max(1, maxZ)) * palette.length) % palette.length;
        return { ...b, color: palette[colorIdx] };
      })
    );

    if (voxelGrid) {
      setTimeout(() => {
        setStatistics(calculateModelStatistics(bricks, voxelGrid));
      }, 50);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        onFileUpload={handleFileUpload}
        onSelectSample={loadSampleModel}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasModel={!!originalGeometry}
        hasBricks={bricks.length > 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left 3D Viewport */}
        <div className="flex-1 h-full relative">
          <Viewport3D
            ref={viewportRef}
            originalGeometry={originalGeometry}
            voxelGrid={voxelGrid}
            bricks={bricks}
            selectedColor={selectedColor}
            paintMode={activeTab === 'paint'}
            onBrickColorChange={handleBrickColorChange}
            activeLayerFilter={activeTab === 'guide' ? null : activeLayerFilter}
            currentStepIndex={activeTab === 'guide' ? currentStepIndex : null}
            showOriginalMesh={showOriginalMesh}
            showGridFloor={showGridFloor}
            explodeFactor={explodeFactor}
          />

          {/* Floating Viewport Quick Controls */}
          <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
            <button
              onClick={() => setShowOriginalMesh(!showOriginalMesh)}
              title={showOriginalMesh ? 'Ocultar Malla STL Original' : 'Mostrar Malla STL Original'}
              className={`p-2 rounded-lg backdrop-blur-md border text-xs flex items-center space-x-1.5 transition ${
                showOriginalMesh
                  ? 'bg-blue-600/40 border-blue-400 text-white shadow-md'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Malla STL</span>
            </button>

            <button
              onClick={() => setShowGridFloor(!showGridFloor)}
              title="Alternar Cama de Impresión"
              className={`p-2 rounded-lg backdrop-blur-md border text-xs flex items-center space-x-1.5 transition ${
                showGridFloor
                  ? 'bg-blue-600/40 border-blue-400 text-white shadow-md'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cama 256mm</span>
            </button>
          </div>

          {/* Quick Stats Pill at Bottom of Viewport */}
          {statistics && (
            <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full px-4 py-1.5 shadow-lg text-xs flex items-center space-x-4 z-10 pointer-events-none">
              <div>
                <span className="text-slate-400">Bloques: </span>
                <span className="font-bold text-white">{statistics.totalBricks}</span>
              </div>
              <div>
                <span className="text-slate-400">Capas: </span>
                <span className="font-bold text-blue-400">{statistics.layerCount}</span>
              </div>
              <div>
                <span className="text-slate-400">Peso: </span>
                <span className="font-bold text-emerald-400">{statistics.estimatedWeightGrams} g</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Control Panel */}
        <aside className="w-80 sm:w-96 h-full bg-slate-900/95 border-l border-slate-800 flex flex-col shadow-2xl z-20 overflow-hidden">
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'voxelize' && (
              <VoxelizerControls
                settings={voxelSettings}
                setSettings={setVoxelSettings}
                onVoxelize={handleRunVoxelization}
                isProcessing={isProcessing}
                modelDimensions={statistics?.dimensionsMm}
              />
            )}

            {activeTab === 'optimize' && (
              <OptimizerControls
                settings={optimizerSettings}
                setSettings={setOptimizerSettings}
                onOptimize={handleRunOptimization}
                isProcessing={isProcessing}
              />
            )}

            {activeTab === 'paint' && (
              <PaintStudio
                selectedColor={selectedColor}
                setSelectedColor={setSelectedColor}
                paintTool={paintTool}
                setPaintTool={setPaintTool}
                onApplyGradient={handleApplyGradient}
                onPaintAll={handlePaintAll}
                onPaintLayer={handlePaintLayer}
                totalBricks={bricks.length}
                activeLayer={currentStepIndex - 1}
                maxLayer={statistics?.layerCount || 1}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogBOM
                statistics={statistics}
                bricks={bricks}
                showNumbers={showNumbers}
                setShowNumbers={setShowNumbers}
              />
            )}

            {activeTab === 'guide' && (
              <AssemblyGuideViewer
                steps={steps}
                currentStepIndex={currentStepIndex}
                setCurrentStepIndex={setCurrentStepIndex}
                statistics={statistics}
                projectName={projectName}
                onCaptureSnapshot={() => viewportRef.current?.captureSnapshot() || ''}
                explodeFactor={explodeFactor}
                setExplodeFactor={setExplodeFactor}
              />
            )}

            {activeTab === 'export' && (
              <ExportControls
                bricks={bricks}
                statistics={statistics}
                projectName={projectName}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
export default App;
