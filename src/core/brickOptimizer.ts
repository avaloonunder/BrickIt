import {
  VoxelGrid,
  BrickInstance,
  FilamentColor,
  OptimizerSettings,
  ModelStatistics,
  AssemblyStep,
} from '../types/brick';
import { BRICK_CATALOG, estimateBrickWeightGrams } from '../constants/brickCatalog';
import { DEFAULT_COLOR } from '../constants/filaments';

interface BlockShape {
  morphologyId: string;
  sizeX: number;
  sizeY: number;
  priority: number;
  orientation: 'horizontal' | 'vertical';
}

/**
 * Decomposes a 3D VoxelGrid into optimized interlocking modular building blocks.
 * Applies alternating running-bond orientation across vertical layers for structural integrity.
 */
export function optimizeVoxelGridToBricks(
  voxelGrid: VoxelGrid,
  settings: OptimizerSettings,
  defaultColor: FilamentColor = DEFAULT_COLOR
): BrickInstance[] {
  const { dimX, dimY, dimZ, data, colors } = voxelGrid;
  const bricks: BrickInstance[] = [];

  // Track which voxels have been claimed by a brick
  const claimed = new Uint8Array(dimX * dimY * dimZ);
  const getIndex = (x: number, y: number, z: number) => z * (dimX * dimY) + y * dimX + x;

  // Filter allowed morphologies
  const activeMorphologies = BRICK_CATALOG.filter((m) =>
    settings.allowedMorphologies.includes(m.id)
  );

  let brickCounter = 1;

  // Process layer by layer from bottom (Z=0) to top (Z=dimZ-1)
  for (let gz = 0; gz < dimZ; gz++) {
    // Determine preferred orientation for this layer (alternating running bond)
    const isEvenLayer = gz % 2 === 0;

    // Generate candidate shapes for this layer
    const candidateShapes: BlockShape[] = [];

    activeMorphologies.forEach((morph) => {
      if (morph.width === morph.length) {
        // Square shape (e.g. 2x2, 1x1)
        candidateShapes.push({
          morphologyId: morph.id,
          sizeX: morph.width,
          sizeY: morph.length,
          priority: morph.priority,
          orientation: 'horizontal',
        });
      } else {
        // Rectangular shape (e.g. 2x4, 1x4, 1x2)
        // Adjust priority based on layer parity for cross-hatch interlocking
        const prefHorizontal = isEvenLayer ? morph.priority + 10 : morph.priority - 10;
        const prefVertical = !isEvenLayer ? morph.priority + 10 : morph.priority - 10;

        // Orientation A: length along X
        candidateShapes.push({
          morphologyId: morph.id,
          sizeX: morph.length,
          sizeY: morph.width,
          priority: prefHorizontal,
          orientation: 'horizontal',
        });

        // Orientation B: length along Y
        candidateShapes.push({
          morphologyId: morph.id,
          sizeX: morph.width,
          sizeY: morph.length,
          priority: prefVertical,
          orientation: 'vertical',
        });
      }
    });

    // Sort candidate shapes by priority descending
    candidateShapes.sort((a, b) => b.priority - a.priority);

    // Multi-pass placement over the layer
    for (const shape of candidateShapes) {
      for (let gy = 0; gy <= dimY - shape.sizeY; gy++) {
        for (let gx = 0; gx <= dimX - shape.sizeX; gx++) {
          // Check if all cells for this shape are occupied in voxelGrid and NOT yet claimed
          let canPlace = true;
          let brickColorHex: string | null = null;

          for (let dy = 0; dy < shape.sizeY; dy++) {
            for (let dx = 0; dx < shape.sizeX; dx++) {
              const idx = getIndex(gx + dx, gy + dy, gz);
              if (data[idx] !== 1 || claimed[idx] === 1) {
                canPlace = false;
                break;
              }

              // Sample color if available
              if (colors && colors[idx] && !brickColorHex) {
                brickColorHex = colors[idx];
              }
            }
            if (!canPlace) break;
          }

          if (canPlace) {
            // Mark cells as claimed
            for (let dy = 0; dy < shape.sizeY; dy++) {
              for (let dx = 0; dx < shape.sizeX; dx++) {
                claimed[getIndex(gx + dx, gy + dy, gz)] = 1;
              }
            }

            const assignedColor: FilamentColor = brickColorHex
              ? {
                  id: `color_${brickColorHex.replace('#', '')}`,
                  name: `Color ${brickColorHex}`,
                  hex: brickColorHex,
                  type: 'Custom',
                }
              : defaultColor;

            bricks.push({
              id: `b_${gz.toString().padStart(2, '0')}_${brickCounter.toString().padStart(4, '0')}`,
              morphologyId: shape.morphologyId,
              gridX: gx,
              gridY: gy,
              gridZ: gz,
              sizeX: shape.sizeX,
              sizeY: shape.sizeY,
              sizeZ: 1,
              color: assignedColor,
              orientation: shape.orientation,
              layerIndex: gz,
              stepNumber: gz + 1,
              partLabel: `#${brickCounter}`,
            });

            brickCounter++;
          }
        }
      }
    }

    // Residual 1x1 placement for any leftover un-claimed voxels
    for (let gy = 0; gy < dimY; gy++) {
      for (let gx = 0; gx < dimX; gx++) {
        const idx = getIndex(gx, gy, gz);
        if (data[idx] === 1 && claimed[idx] === 0) {
          claimed[idx] = 1;

          const assignedColor: FilamentColor = colors && colors[idx]
            ? {
                id: `color_${colors[idx]!.replace('#', '')}`,
                name: `Color ${colors[idx]}`,
                hex: colors[idx]!,
                type: 'Custom',
              }
            : defaultColor;

          bricks.push({
            id: `b_${gz.toString().padStart(2, '0')}_${brickCounter.toString().padStart(4, '0')}`,
            morphologyId: 'MB-11',
            gridX: gx,
            gridY: gy,
            gridZ: gz,
            sizeX: 1,
            sizeY: 1,
            sizeZ: 1,
            color: assignedColor,
            orientation: 'horizontal',
            layerIndex: gz,
            stepNumber: gz + 1,
            partLabel: `#${brickCounter}`,
          });

          brickCounter++;
        }
      }
    }
  }

  return bricks;
}

/**
 * Calculates complete statistics, part counts, weight, and volume for a model.
 */
export function calculateModelStatistics(
  bricks: BrickInstance[],
  voxelGrid: VoxelGrid
): ModelStatistics {
  const morphologyCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};

  let totalVolumeCm3 = 0;
  let estimatedWeightGrams = 0;
  let maxZ = 0;

  for (const b of bricks) {
    morphologyCounts[b.morphologyId] = (morphologyCounts[b.morphologyId] || 0) + 1;
    const colorKey = b.color.hex;
    colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;

    const weight = estimateBrickWeightGrams(b.sizeX, b.sizeY, b.sizeZ);
    estimatedWeightGrams += weight;
    totalVolumeCm3 += (b.sizeX * 8.0 * b.sizeY * 8.0 * b.sizeZ * 9.6) / 1000.0;

    if (b.layerIndex > maxZ) {
      maxZ = b.layerIndex;
    }
  }

  const dimensionsMm = {
    x: voxelGrid.dimX * voxelGrid.pitchX,
    y: voxelGrid.dimY * voxelGrid.pitchY,
    z: (maxZ + 1) * voxelGrid.pitchZ,
  };

  return {
    totalBricks: bricks.length,
    totalVoxels: bricks.reduce((acc, b) => acc + b.sizeX * b.sizeY * b.sizeZ, 0),
    totalVolumeCm3: Math.round(totalVolumeCm3 * 10) / 10,
    estimatedWeightGrams: Math.round(estimatedWeightGrams * 10) / 10,
    layerCount: maxZ + 1,
    dimensionsMm,
    morphologyCounts,
    colorCounts,
  };
}

/**
 * Groups bricks into sequential assembly steps (layer-by-layer).
 */
export function generateAssemblySteps(bricks: BrickInstance[]): AssemblyStep[] {
  const layerMap = new Map<number, BrickInstance[]>();

  for (const b of bricks) {
    if (!layerMap.has(b.layerIndex)) {
      layerMap.set(b.layerIndex, []);
    }
    layerMap.get(b.layerIndex)!.push(b);
  }

  const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);
  const steps: AssemblyStep[] = [];
  let runningTotal = 0;

  for (let i = 0; i < sortedLayers.length; i++) {
    const layerIdx = sortedLayers[i];
    const layerBricks = layerMap.get(layerIdx)!;
    runningTotal += layerBricks.length;

    steps.push({
      stepIndex: i + 1,
      layerIndex: layerIdx,
      bricksAdded: layerBricks,
      totalBricksSoFar: runningTotal,
      description: `Capa ${layerIdx + 1} de ${sortedLayers.length} (${layerBricks.length} piezas)`,
    });
  }

  return steps;
}
