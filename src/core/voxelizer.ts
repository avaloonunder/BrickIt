import * as THREE from 'three';
import { VoxelGrid, VoxelizerSettings } from '../types/brick';
import { triangleIntersectsAABB } from './math3d';

/**
 * High-precision 3D Voxelizer for modular interlocking bricks.
 * Uses Conservative 26-Connected Surface Rasterization + 3D Topological Flood-Fill.
 * - Fills 100% of internal solid volumes without leaving internal holes or gaps.
 * - Preserves all geometric holes (rings, toruses, tubes, arches, windows).
 *
 * Coordinate mapping:
 * - Mesh X -> gridX (width)
 * - Mesh Y -> gridZ / layerIndex (vertical height)
 * - Mesh Z -> gridY (depth)
 */
export function voxelizeGeometry(
  geometry: THREE.BufferGeometry,
  settings: VoxelizerSettings
): VoxelGrid {
  const geo = geometry.toNonIndexed();
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;

  const size = new THREE.Vector3();
  bbox.getSize(size);

  const pitchX = settings.pitchMm; // 8.0 mm (width)
  const pitchZ = settings.pitchMm; // 8.0 mm (depth along mesh Z)
  const pitchY = settings.heightMm; // 9.6 mm (height along mesh Y)

  // Compute scaling factor based on target resolution
  const maxDimUnits = Math.max(
    size.x / pitchX,
    size.y / pitchY,
    size.z / pitchZ
  );

  let scale = 1.0;
  if (settings.targetResolution > 0 && maxDimUnits > 0) {
    scale = settings.targetResolution / maxDimUnits;
  }

  const effPitchX = pitchX / scale;
  const effPitchY = pitchY / scale; // vertical height (mesh Y)
  const effPitchZ = pitchZ / scale; // depth (mesh Z)

  const dimX = Math.max(1, Math.ceil(size.x / effPitchX));
  const dimZ_layers = Math.max(1, Math.ceil(size.y / effPitchY)); // vertical layers
  const dimY_depth = Math.max(1, Math.ceil(size.z / effPitchZ));  // depth

  const totalCells = dimX * dimY_depth * dimZ_layers;
  const surfaceGrid = new Uint8Array(totalCells);
  const resultGrid = new Uint8Array(totalCells);

  const getIndex = (gx: number, gy: number, gz: number) => {
    return gz * (dimX * dimY_depth) + gy * dimX + gx;
  };

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const numTriangles = posAttr.count / 3;

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const triMin = new THREE.Vector3();
  const triMax = new THREE.Vector3();
  const cellMin = new THREE.Vector3();
  const cellMax = new THREE.Vector3();

  // 1. Conservative Surface Rasterization
  // A. Triangle-AABB intersection
  for (let t = 0; t < numTriangles; t++) {
    v0.fromBufferAttribute(posAttr, t * 3);
    v1.fromBufferAttribute(posAttr, t * 3 + 1);
    v2.fromBufferAttribute(posAttr, t * 3 + 2);

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

    const minGX = Math.max(0, Math.floor((triMin.x - bbox.min.x) / effPitchX));
    const maxGX = Math.min(dimX - 1, Math.floor((triMax.x - bbox.min.x) / effPitchX));

    const minGZ = Math.max(0, Math.floor((triMin.y - bbox.min.y) / effPitchY));
    const maxGZ = Math.min(dimZ_layers - 1, Math.floor((triMax.y - bbox.min.y) / effPitchY));

    const minGY = Math.max(0, Math.floor((triMin.z - bbox.min.z) / effPitchZ));
    const maxGY = Math.min(dimY_depth - 1, Math.floor((triMax.z - bbox.min.z) / effPitchZ));

    for (let gz = minGZ; gz <= maxGZ; gz++) {
      cellMin.y = bbox.min.y + gz * effPitchY;
      cellMax.y = cellMin.y + effPitchY;

      for (let gy = minGY; gy <= maxGY; gy++) {
        cellMin.z = bbox.min.z + gy * effPitchZ;
        cellMax.z = cellMin.z + effPitchZ;

        for (let gx = minGX; gx <= maxGX; gx++) {
          const idx = getIndex(gx, gy, gz);
          if (surfaceGrid[idx] === 1) continue;

          cellMin.x = bbox.min.x + gx * effPitchX;
          cellMax.x = cellMin.x + effPitchX;

          if (triangleIntersectsAABB(cellMin, cellMax, v0, v1, v2)) {
            surfaceGrid[idx] = 1;
          }
        }
      }
    }

    // B. Dense Point Sub-Sampling on Triangle Surface (prevents diagonal flood-fill leaks)
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const len1 = edge1.length();
    const len2 = edge2.length();
    const minPitch = Math.min(effPitchX, effPitchY, effPitchZ);
    const steps1 = Math.max(1, Math.ceil(len1 / (minPitch * 0.4)));
    const steps2 = Math.max(1, Math.ceil(len2 / (minPitch * 0.4)));

    const pt = new THREE.Vector3();
    for (let i = 0; i <= steps1; i++) {
      const u = i / steps1;
      for (let j = 0; j <= steps2; j++) {
        const v = j / steps2;
        if (u + v <= 1.0) {
          pt.copy(v0).addScaledVector(edge1, u).addScaledVector(edge2, v);

          const gx = Math.floor((pt.x - bbox.min.x) / effPitchX);
          const gz = Math.floor((pt.y - bbox.min.y) / effPitchY);
          const gy = Math.floor((pt.z - bbox.min.z) / effPitchZ);

          if (gx >= 0 && gx < dimX && gy >= 0 && gy < dimY_depth && gz >= 0 && gz < dimZ_layers) {
            surfaceGrid[getIndex(gx, gy, gz)] = 1;
          }
        }
      }
    }
  }

  // 2. Solid Filling vs Shell Mode
  if (settings.fillMode === 'solid') {
    // 3D Topological Outside BFS
    // Create padded grid with 1 cell border of air in all directions
    const padX = dimX + 2;
    const padY = dimY_depth + 2;
    const padZ = dimZ_layers + 2;
    const padTotal = padX * padY * padZ;

    const padGrid = new Uint8Array(padTotal); // 0 = unvisited air, 1 = surface wall, 2 = outside air

    const getPadIndex = (px: number, py: number, pz: number) => {
      return pz * (padX * padY) + py * padX + px;
    };

    // Copy surface voxels to padded grid
    for (let gz = 0; gz < dimZ_layers; gz++) {
      for (let gy = 0; gy < dimY_depth; gy++) {
        for (let gx = 0; gx < dimX; gx++) {
          if (surfaceGrid[getIndex(gx, gy, gz)] === 1) {
            padGrid[getPadIndex(gx + 1, gy + 1, gz + 1)] = 1;
          }
        }
      }
    }

    // BFS Queue for outside air traversal
    const queue = new Int32Array(padTotal);
    let head = 0;
    let tail = 0;

    // Start BFS at (0, 0, 0)
    padGrid[0] = 2; // Outside air
    queue[tail++] = 0;

    const neighbors = [
      [-1, 0, 0], [1, 0, 0],
      [0, -1, 0], [0, 1, 0],
      [0, 0, -1], [0, 0, 1],
    ];

    while (head < tail) {
      const cur = queue[head++];
      const pz = Math.floor(cur / (padX * padY));
      const rem = cur % (padX * padY);
      const py = Math.floor(rem / padX);
      const px = rem % padX;

      for (let i = 0; i < 6; i++) {
        const nx = px + neighbors[i][0];
        const ny = py + neighbors[i][1];
        const nz = pz + neighbors[i][2];

        if (nx >= 0 && nx < padX && ny >= 0 && ny < padY && nz >= 0 && nz < padZ) {
          const nIdx = getPadIndex(nx, ny, nz);
          if (padGrid[nIdx] === 0) {
            padGrid[nIdx] = 2; // Mark as outside air
            queue[tail++] = nIdx;
          }
        }
      }
    }

    // Extract Solid Voxels:
    // Any cell NOT reached by the outside air (padGrid !== 2) is INSIDE the solid volume!
    for (let gz = 0; gz < dimZ_layers; gz++) {
      for (let gy = 0; gy < dimY_depth; gy++) {
        for (let gx = 0; gx < dimX; gx++) {
          const padIdx = getPadIndex(gx + 1, gy + 1, gz + 1);
          if (padGrid[padIdx] !== 2) {
            resultGrid[getIndex(gx, gy, gz)] = 1;
          }
        }
      }
    }
  } else {
    // Shell Mode: copy surface grid
    resultGrid.set(surfaceGrid);
  }

  return {
    dimX,
    dimY: dimY_depth,
    dimZ: dimZ_layers,
    pitchX: settings.pitchMm,
    pitchY: settings.pitchMm,
    pitchZ: settings.heightMm,
    data: resultGrid,
  };
}
