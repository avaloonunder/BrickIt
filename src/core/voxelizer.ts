import * as THREE from 'three';
import { VoxelGrid, VoxelizerSettings } from '../types/brick';
import { triangleIntersectsAABB } from './math3d';

/**
 * Voxelizes a 3D geometry into a discrete 3D grid matching modular brick proportions.
 */
export function voxelizeGeometry(
  geometry: THREE.BufferGeometry,
  settings: VoxelizerSettings
): VoxelGrid {
  // Ensure non-indexed geometry with computed bounding box
  const geo = geometry.toNonIndexed();
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;

  const size = new THREE.Vector3();
  bbox.getSize(size);

  const pitchX = settings.pitchMm;
  const pitchY = settings.pitchMm;
  const pitchZ = settings.heightMm;

  // Compute grid dimensions based on target resolution or physical pitch
  const maxDim = Math.max(size.x / pitchX, size.y / pitchY, size.z / pitchZ);
  let scale = 1.0;

  if (settings.targetResolution > 0 && maxDim > 0) {
    scale = settings.targetResolution / maxDim;
  }

  // Scaled pitch
  const effectivePitchX = pitchX / scale;
  const effectivePitchY = pitchY / scale;
  const effectivePitchZ = pitchZ / scale;

  const dimX = Math.max(1, Math.ceil(size.x / effectivePitchX));
  const dimY = Math.max(1, Math.ceil(size.y / effectivePitchY));
  const dimZ = Math.max(1, Math.ceil(size.z / effectivePitchZ));

  const totalCells = dimX * dimY * dimZ;
  const surfaceGrid = new Uint8Array(totalCells);

  const getIndex = (x: number, y: number, z: number) => {
    return z * (dimX * dimY) + y * dimX + x;
  };

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const numTriangles = posAttr.count / 3;

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const triMin = new THREE.Vector3();
  const triMax = new THREE.Vector3();

  // 1. Surface Voxelization: Test each triangle against overlapping voxel AABBs
  for (let t = 0; t < numTriangles; t++) {
    v0.fromBufferAttribute(posAttr, t * 3);
    v1.fromBufferAttribute(posAttr, t * 3 + 1);
    v2.fromBufferAttribute(posAttr, t * 3 + 2);

    // Triangle bounding box
    triMin.set(
      Math.min(v0.x, v1.x, v2.x),
      Math.min(v0.y, v1.y, v2.y),
      Math.min(v0.z, v1.z, v2.z)
    );
    triMax.set(
      Math.max(v0.x, v1.x, v2.x),
      Math.max(v0.y, v1.y, v2.y),
      Math.max(v0.z, v1.z, v2.z)
    );

    // Grid coordinate range for this triangle
    const minGX = Math.max(0, Math.floor((triMin.x - bbox.min.x) / effectivePitchX));
    const maxGX = Math.min(dimX - 1, Math.floor((triMax.x - bbox.min.x) / effectivePitchX));

    const minGY = Math.max(0, Math.floor((triMin.y - bbox.min.y) / effectivePitchY));
    const maxGY = Math.min(dimY - 1, Math.floor((triMax.y - bbox.min.y) / effectivePitchY));

    const minGZ = Math.max(0, Math.floor((triMin.z - bbox.min.z) / effectivePitchZ));
    const maxGZ = Math.min(dimZ - 1, Math.floor((triMax.z - bbox.min.z) / effectivePitchZ));

    const cellMin = new THREE.Vector3();
    const cellMax = new THREE.Vector3();

    for (let gz = minGZ; gz <= maxGZ; gz++) {
      cellMin.z = bbox.min.z + gz * effectivePitchZ;
      cellMax.z = cellMin.z + effectivePitchZ;

      for (let gy = minGY; gy <= maxGY; gy++) {
        cellMin.y = bbox.min.y + gy * effectivePitchY;
        cellMax.y = cellMin.y + effectivePitchY;

        for (let gx = minGX; gx <= maxGX; gx++) {
          const idx = getIndex(gx, gy, gz);
          if (surfaceGrid[idx] === 1) continue;

          cellMin.x = bbox.min.x + gx * effectivePitchX;
          cellMax.x = cellMin.x + effectivePitchX;

          if (triangleIntersectsAABB(cellMin, cellMax, v0, v1, v2)) {
            surfaceGrid[idx] = 1;
          }
        }
      }
    }
  }

  // 2. Interior Filling (Solid Mode / Shell Mode)
  let resultGrid = new Uint8Array(surfaceGrid);

  if (settings.fillMode === 'solid') {
    // Parity / Span filling along X axis for each (Y, Z) line
    for (let gz = 0; gz < dimZ; gz++) {
      for (let gy = 0; gy < dimY; gy++) {
        let firstInside = -1;
        let lastInside = -1;

        for (let gx = 0; gx < dimX; gx++) {
          if (surfaceGrid[getIndex(gx, gy, gz)] === 1) {
            if (firstInside === -1) firstInside = gx;
            lastInside = gx;
          }
        }

        if (firstInside !== -1 && lastInside !== -1 && lastInside > firstInside) {
          // Check if Y axis also has boundaries to avoid leaking open meshes
          for (let gx = firstInside; gx <= lastInside; gx++) {
            resultGrid[getIndex(gx, gy, gz)] = 1;
          }
        }
      }
    }

    // Secondary Y span check to clean up non-convex overhangs
    for (let gz = 0; gz < dimZ; gz++) {
      for (let gx = 0; gx < dimX; gx++) {
        let firstY = -1;
        let lastY = -1;

        for (let gy = 0; gy < dimY; gy++) {
          if (surfaceGrid[getIndex(gx, gy, gz)] === 1) {
            if (firstY === -1) firstY = gy;
            lastY = gy;
          }
        }

        for (let gy = 0; gy < dimY; gy++) {
          const idx = getIndex(gx, gy, gz);
          if (gy < firstY || gy > lastY) {
            resultGrid[idx] = 0;
          }
        }
      }
    }
  }

  // If shell mode, erode interior leaving shellThickness voxels
  if (settings.fillMode === 'shell' && settings.shellThickness > 1) {
    // For shell mode with thickness, dilate surface
    const shellGrid = new Uint8Array(surfaceGrid);
    const thick = settings.shellThickness;

    for (let gz = 0; gz < dimZ; gz++) {
      for (let gy = 0; gy < dimY; gy++) {
        for (let gx = 0; gx < dimX; gx++) {
          if (surfaceGrid[getIndex(gx, gy, gz)] === 1) {
            for (let dz = -thick + 1; dz < thick; dz++) {
              for (let dy = -thick + 1; dy < thick; dy++) {
                for (let dx = -thick + 1; dx < thick; dx++) {
                  const nx = gx + dx;
                  const ny = gy + dy;
                  const nz = gz + dz;
                  if (nx >= 0 && nx < dimX && ny >= 0 && ny < dimY && nz >= 0 && nz < dimZ) {
                    shellGrid[getIndex(nx, ny, nz)] = 1;
                  }
                }
              }
            }
          }
        }
      }
    }
    resultGrid = shellGrid;
  }

  return {
    dimX,
    dimY,
    dimZ,
    pitchX: settings.pitchMm,
    pitchY: settings.pitchMm,
    pitchZ: settings.heightMm,
    data: resultGrid,
  };
}
