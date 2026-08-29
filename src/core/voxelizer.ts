import * as THREE from 'three';
import { VoxelGrid, VoxelizerSettings } from '../types/brick';
import { triangleIntersectsAABB } from './math3d';

/**
 * High-precision 3D Voxelizer for modular interlocking bricks.
 * Coordinate mapping:
 * - Mesh X -> gridX (width)
 * - Mesh Y -> gridZ / layerIndex (vertical height)
 * - Mesh Z -> gridY (depth)
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

  const pitchX = settings.pitchMm; // 8.0 mm
  const pitchZ = settings.pitchMm; // 8.0 mm (depth along mesh Z)
  const pitchY = settings.heightMm; // 9.6 mm (height along mesh Y)

  // Compute grid dimensions based on target resolution
  // We want the largest dimension to have approximately `settings.targetResolution` voxels
  const maxDimUnits = Math.max(
    size.x / pitchX,
    size.y / pitchY,
    size.z / pitchZ
  );

  let scale = 1.0;
  if (settings.targetResolution > 0 && maxDimUnits > 0) {
    scale = settings.targetResolution / maxDimUnits;
  }

  // Effective pitch in world mesh units
  const effPitchX = pitchX / scale;
  const effPitchY = pitchY / scale; // vertical (mesh Y)
  const effPitchZ = pitchZ / scale; // depth (mesh Z)

  const dimX = Math.max(1, Math.ceil(size.x / effPitchX));
  const dimZ_layers = Math.max(1, Math.ceil(size.y / effPitchY)); // vertical layers
  const dimY_depth = Math.max(1, Math.ceil(size.z / effPitchZ));  // depth

  const totalCells = dimX * dimY_depth * dimZ_layers;
  const surfaceGrid = new Uint8Array(totalCells);

  // Helper index: gridX in [0, dimX-1], gridY (depth) in [0, dimY_depth-1], gridZ (layer) in [0, dimZ_layers-1]
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

  // 1. Surface Voxelization: Test each triangle against overlapping voxel boxes
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

    // Grid coordinate ranges for this triangle:
    // X -> gx, Y (vertical) -> gz, Z (depth) -> gy
    const minGX = Math.max(0, Math.floor((triMin.x - bbox.min.x) / effPitchX));
    const maxGX = Math.min(dimX - 1, Math.floor((triMax.x - bbox.min.x) / effPitchX));

    const minGZ = Math.max(0, Math.floor((triMin.y - bbox.min.y) / effPitchY));
    const maxGZ = Math.min(dimZ_layers - 1, Math.floor((triMax.y - bbox.min.y) / effPitchY));

    const minGY = Math.max(0, Math.floor((triMin.z - bbox.min.z) / effPitchZ));
    const maxGY = Math.min(dimY_depth - 1, Math.floor((triMax.z - bbox.min.z) / effPitchZ));

    for (let gz = minGZ; gz <= maxGZ; gz++) {
      // Mesh Y range
      cellMin.y = bbox.min.y + gz * effPitchY;
      cellMax.y = cellMin.y + effPitchY;

      for (let gy = minGY; gy <= maxGY; gy++) {
        // Mesh Z range
        cellMin.z = bbox.min.z + gy * effPitchZ;
        cellMax.z = cellMin.z + effPitchZ;

        for (let gx = minGX; gx <= maxGX; gx++) {
          const idx = getIndex(gx, gy, gz);
          if (surfaceGrid[idx] === 1) continue;

          // Mesh X range
          cellMin.x = bbox.min.x + gx * effPitchX;
          cellMax.x = cellMin.x + effPitchX;

          if (triangleIntersectsAABB(cellMin, cellMax, v0, v1, v2)) {
            surfaceGrid[idx] = 1;
          }
        }
      }
    }
  }

  // 2. Interior Solid Filling via 3D Exterior BFS Flood-Fill
  let resultGrid = new Uint8Array(totalCells);

  if (settings.fillMode === 'solid') {
    // Pad grid by 1 cell on all boundaries: (dimX + 2) x (dimY_depth + 2) x (dimZ_layers + 2)
    const padX = dimX + 2;
    const padY = dimY_depth + 2;
    const padZ = dimZ_layers + 2;
    const padTotal = padX * padY * padZ;

    const padGrid = new Uint8Array(padTotal); // 0 = unvisited, 1 = surface, 2 = outside air

    const getPadIndex = (px: number, py: number, pz: number) => {
      return pz * (padX * padY) + py * padX + px;
    };

    // Copy surface voxels into padded grid
    for (let gz = 0; gz < dimZ_layers; gz++) {
      for (let gy = 0; gy < dimY_depth; gy++) {
        for (let gx = 0; gx < dimX; gx++) {
          if (surfaceGrid[getIndex(gx, gy, gz)] === 1) {
            padGrid[getPadIndex(gx + 1, gy + 1, gz + 1)] = 1;
          }
        }
      }
    }

    // BFS Flood Fill from (0, 0, 0)
    // Using Int32Array queue for maximum speed
    const queue = new Int32Array(padTotal);
    let head = 0;
    let tail = 0;

    padGrid[0] = 2; // Marked as outside air
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

    // Any cell in the original grid that was NOT reached by the exterior air is INSIDE (solid)
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
    // Shell mode: use surface grid
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
