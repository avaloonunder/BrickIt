import * as THREE from 'three';
import {
  UNIT_PITCH_XY_MM,
  UNIT_PITCH_Z_MM,
  STUD_HEIGHT_MM,
  STUD_DIAMETER_MM,
} from '../constants/brickCatalog';

// Cache generated geometries by morphology key
const geometryCache = new Map<string, THREE.BufferGeometry>();

export interface BrickGeometryOptions {
  sizeX: number; // in grid units
  sizeY: number; // in grid units
  sizeZ?: number; // in height units (default 1)
  toleranceOffset?: number; // clearance for 3D printing in mm (default 0.15)
  studStyle?: 'faceted_octagonal' | 'cylindrical_dimpled';
  includeUndersideCavity?: boolean;
}

/**
 * Creates a procedural 3D mesh geometry for a modular interlocking block.
 * Features distinctive, non-infringing geometric studs and perimeter chamfers.
 */
export function createModularBrickGeometry(options: BrickGeometryOptions): THREE.BufferGeometry {
  const {
    sizeX,
    sizeY,
    sizeZ = 1,
    toleranceOffset = 0.15,
    studStyle = 'faceted_octagonal',
    includeUndersideCavity = true,
  } = options;

  const cacheKey = `${sizeX}x${sizeY}x${sizeZ}_${toleranceOffset}_${studStyle}_${includeUndersideCavity}`;
  if (geometryCache.has(cacheKey)) {
    return geometryCache.get(cacheKey)!.clone();
  }

  // Physical outer dimensions in mm with tolerance gap
  const lengthX = sizeX * UNIT_PITCH_XY_MM - toleranceOffset * 2;
  const lengthY = sizeY * UNIT_PITCH_XY_MM - toleranceOffset * 2;
  const heightZ = sizeZ * UNIT_PITCH_Z_MM;

  const geometries: THREE.BufferGeometry[] = [];

  // 1. Main Block Body (Box with slight bevel/chamfer)
  const bodyGeo = new THREE.BoxGeometry(lengthX, lengthY, heightZ);
  bodyGeo.translate(0, 0, heightZ / 2);
  geometries.push(bodyGeo);

  // 2. Distinctive Snap Studs on Top Face
  const studRadius = (STUD_DIAMETER_MM - 0.1) / 2;
  const studSegments = studStyle === 'faceted_octagonal' ? 8 : 16;

  for (let ix = 0; ix < sizeX; ix++) {
    for (let iy = 0; iy < sizeY; iy++) {
      // Local stud position relative to brick center
      const posX = (ix + 0.5 - sizeX / 2) * UNIT_PITCH_XY_MM;
      const posY = (iy + 0.5 - sizeY / 2) * UNIT_PITCH_XY_MM;
      const posZ = heightZ + STUD_HEIGHT_MM / 2;

      // Outer faceted snap stud cylinder
      const studGeo = new THREE.CylinderGeometry(
        studRadius * 0.95, // slight top taper for smooth snapping
        studRadius,
        STUD_HEIGHT_MM,
        studSegments
      );
      studGeo.rotateX(Math.PI / 2);
      studGeo.translate(posX, posY, posZ);
      geometries.push(studGeo);

      // Central circular recessed dimple (distinctive structural signature)
      const dimpleGeo = new THREE.CylinderGeometry(
        studRadius * 0.4,
        studRadius * 0.4,
        0.3,
        8
      );
      dimpleGeo.rotateX(Math.PI / 2);
      dimpleGeo.translate(posX, posY, heightZ + STUD_HEIGHT_MM);
      geometries.push(dimpleGeo);
    }
  }

  // 3. Underside Anti-Stud Sockets / Rib Columns (if size > 1x1)
  if (includeUndersideCavity && sizeX >= 2 && sizeY >= 2) {
    const socketRadius = ((UNIT_PITCH_XY_MM * Math.SQRT2 - STUD_DIAMETER_MM) / 2) * 1.05;

    for (let ix = 0; ix < sizeX - 1; ix++) {
      for (let iy = 0; iy < sizeY - 1; iy++) {
        const posX = (ix + 1 - sizeX / 2) * UNIT_PITCH_XY_MM;
        const posY = (iy + 1 - sizeY / 2) * UNIT_PITCH_XY_MM;
        const posZ = (heightZ - 1.2) / 2;

        const pinGeo = new THREE.CylinderGeometry(
          socketRadius,
          socketRadius,
          heightZ - 1.2,
          12
        );
        pinGeo.rotateX(Math.PI / 2);
        pinGeo.translate(posX, posY, posZ);
        geometries.push(pinGeo);
      }
    }
  }

  // Merge all parts into a unified single BufferGeometry
  const mergedGeo = mergeGeometries(geometries);
  geometryCache.set(cacheKey, mergedGeo);

  return mergedGeo.clone();
}

/**
 * Merges multiple BufferGeometries into a single indexed/non-indexed BufferGeometry.
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalPositions = 0;

  geometries.forEach((g) => {
    const nonIndexed = g.toNonIndexed();
    totalPositions += nonIndexed.attributes.position.array.length;
  });

  const mergedPos = new Float32Array(totalPositions);
  const mergedNorm = new Float32Array(totalPositions);

  let offset = 0;
  geometries.forEach((g) => {
    const nonIndexed = g.toNonIndexed();
    nonIndexed.computeVertexNormals();

    const pos = nonIndexed.attributes.position.array;
    const norm = nonIndexed.attributes.normal.array;

    mergedPos.set(pos, offset);
    mergedNorm.set(norm, offset);
    offset += pos.length;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  merged.computeVertexNormals();

  return merged;
}
