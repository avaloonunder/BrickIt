// Data types for Modular Bricks 3D engine

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
  size: Vector3D;
}

export interface FilamentColor {
  id: string;
  name: string;
  hex: string; // e.g. "#E53935"
  type: 'Basic PLA' | 'Matte PLA' | 'Silk PLA' | 'PETG' | 'Custom';
  bambuSlot?: number; // 1-16 for AMS slot mapping
}

export interface MorphologyDefinition {
  id: string;         // e.g. "MB-24", "MB-22", "MB-14", "MB-12", "MB-11"
  name: string;       // e.g. "Bloque Modular 2x4", "Modular Block 2x4"
  width: number;      // Grid units in X (e.g. 2)
  length: number;     // Grid units in Y (e.g. 4)
  height: number;     // Grid units in Z (standard full brick = 1, plate = 1/3)
  studCount: number;  // width * length
  isPlate?: boolean;
  enabled: boolean;
  priority: number;   // Higher priority bricks are preferred in greedy solver
}

export interface BrickInstance {
  id: string;               // Unique ID, e.g. "brick_0042"
  morphologyId: string;     // e.g. "MB-24"
  gridX: number;            // Min grid coordinate X
  gridY: number;            // Min grid coordinate Y
  gridZ: number;            // Layer coordinate Z (0, 1, 2...)
  sizeX: number;            // Units along X (e.g. 2 or 4 depending on orientation)
  sizeY: number;            // Units along Y (e.g. 4 or 2 depending on orientation)
  sizeZ: number;            // Units along Z (default 1)
  color: FilamentColor;
  orientation: 'horizontal' | 'vertical'; // Horizontal (X is length) or Vertical (Y is length)
  layerIndex: number;
  stepNumber: number;       // For assembly instruction sequencing
  partLabel?: string;       // e.g. "#42" or morphology shortcode
}

export interface VoxelGrid {
  dimX: number;
  dimY: number;
  dimZ: number;
  pitchX: number; // Real physical dimension in mm (e.g. 8.0 mm)
  pitchY: number; // Real physical dimension in mm (e.g. 8.0 mm)
  pitchZ: number; // Real physical dimension in mm (e.g. 9.6 mm)
  data: Uint8Array; // 1 if occupied, 0 if empty
  colors?: (string | null)[]; // Optional hex color per voxel
}

export interface ModelStatistics {
  totalBricks: number;
  totalVoxels: number;
  totalVolumeCm3: number;
  estimatedWeightGrams: number;
  layerCount: number;
  dimensionsMm: Vector3D;
  morphologyCounts: Record<string, number>;
  colorCounts: Record<string, number>;
}

export interface AssemblyStep {
  stepIndex: number;
  layerIndex: number;
  bricksAdded: BrickInstance[];
  totalBricksSoFar: number;
  description: string;
}

export interface VoxelizerSettings {
  pitchMm: number;        // Brick unit width in mm (default 8.0)
  heightMm: number;       // Brick unit height in mm (default 9.6)
  targetResolution: number; // Grid max dimension (e.g. 20 - 60 voxels)
  fillMode: 'solid' | 'shell' | 'hollow_supports';
  shellThickness: number; // Voxel thickness if shell
  autoCenter: boolean;
}

export interface OptimizerSettings {
  allowedMorphologies: string[]; // IDs of enabled block types
  interlockStrength: 'low' | 'balanced' | 'maximum'; // Bond pattern weighting
  plateSupport: boolean;
  minInterlockOverlap: number; // Min overlap in units between adjacent layers
}

export interface SlicerExportSettings {
  targetSlicer: 'bambu' | 'orca' | 'generic3mf';
  exportMode: 'assembled' | 'plate_nested' | 'color_grouped_stl';
  bedSizeX: number; // e.g. 256 mm
  bedSizeY: number; // e.g. 256 mm
  bedSpacing: number; // Spacing between parts in mm (e.g. 4.0 mm)
  toleranceOffsetMm: number; // Clearance for snap sockets (e.g. 0.18 mm)
  embossLabels: boolean; // Emboss part morphology ID on the bottom
}
