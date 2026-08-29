import { MorphologyDefinition } from '../types/brick';

export const BRICK_CATALOG: MorphologyDefinition[] = [
  {
    id: 'MB-24',
    name: 'Bloque Modular 2x4',
    width: 2,
    length: 4,
    height: 1,
    studCount: 8,
    enabled: true,
    priority: 100, // Highest priority for maximum structure
  },
  {
    id: 'MB-23',
    name: 'Bloque Modular 2x3',
    width: 2,
    length: 3,
    height: 1,
    studCount: 6,
    enabled: true,
    priority: 85,
  },
  {
    id: 'MB-22',
    name: 'Bloque Modular 2x2',
    width: 2,
    length: 2,
    height: 1,
    studCount: 4,
    enabled: true,
    priority: 75,
  },
  {
    id: 'MB-14',
    name: 'Bloque Modular 1x4',
    width: 1,
    length: 4,
    height: 1,
    studCount: 4,
    enabled: true,
    priority: 60,
  },
  {
    id: 'MB-13',
    name: 'Bloque Modular 1x3',
    width: 1,
    length: 3,
    height: 1,
    studCount: 3,
    enabled: true,
    priority: 50,
  },
  {
    id: 'MB-12',
    name: 'Bloque Modular 1x2',
    width: 1,
    length: 2,
    height: 1,
    studCount: 2,
    enabled: true,
    priority: 40,
  },
  {
    id: 'MB-11',
    name: 'Bloque Modular 1x1',
    width: 1,
    length: 1,
    height: 1,
    studCount: 1,
    enabled: true,
    priority: 10, // Lowest priority (filler)
  },
];

export const UNIT_PITCH_XY_MM = 8.0;   // 8.0 mm per grid stud in X and Y
export const UNIT_PITCH_Z_MM = 9.6;    // 9.6 mm per standard height unit
export const STUD_HEIGHT_MM = 1.6;     // 1.6 mm snap stud height
export const STUD_DIAMETER_MM = 4.8;   // 4.8 mm outer stud diameter
export const PLA_DENSITY_G_CM3 = 1.24; // Standard PLA density

/**
 * Calculates estimated plastic weight (in grams) for a given morphology and count.
 */
export function estimateBrickWeightGrams(width: number, length: number, heightUnits: number = 1): number {
  // Approximate volume in cm3 for 3D printed shell + infill
  // Outer volume = (w * 8) * (l * 8) * (h * 9.6) mm3 = (w * l * h * 614.4) mm3 = 0.6144 cm3 per 1x1 unit
  // Accounting for hollow underside and ~25% infill shell: ~40% of solid volume
  const solidVolumeCm3 = (width * UNIT_PITCH_XY_MM * length * UNIT_PITCH_XY_MM * heightUnits * UNIT_PITCH_Z_MM) / 1000.0;
  const netPlasticVolumeCm3 = solidVolumeCm3 * 0.42;
  return netPlasticVolumeCm3 * PLA_DENSITY_G_CM3;
}
