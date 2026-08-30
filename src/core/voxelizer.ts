import * as THREE from 'three';
import { VoxelGrid, VoxelizerSettings } from '../types/brick';
import { triangleIntersectsAABB } from './math3d';

/**
 * Robust Möller-Trumbore Ray-Triangle intersection test along the +X ray at a fixed (Y, Z).
 * Returns the intersection X coordinate if the ray hits the triangle interior, or null.
 */
function rayIntersectTriangleX(
  rayOriginY: number,
  rayOriginZ: number,
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3
): number | null {
  // Bounding box in (Y, Z) plane pre-filter
  const minY = Math.min(v0.y, v1.y, v2.y);
  const maxY = Math.max(v0.y, v1.y, v2.y);
  const minZ = Math.min(v0.z, v1.z, v2.z);
  const maxZ = Math.max(v0.z, v1.z, v2.z);

  if (rayOriginY < minY - 1e-4 || rayOriginY > maxY + 1e-4 || rayOriginZ < minZ - 1e-4 || rayOriginZ > maxZ + 1e-4) {
    return null;
  }

  const e1x = v1.x - v0.x;
  const e1y = v1.y - v0.y;
  const e1z = v1.z - v0.z;

  const e2x = v2.x - v0.x;
  const e2y = v2.y - v0.y;
  const e2z = v2.z - v0.z;

  // Direction is (1, 0, 0)
  // Cross(D, e2) = (0, e2z, -e2y)
  const pvecY = e2z;
  const pvecZ = -e2y;

  const det = e1y * pvecY + e1z * pvecZ; // Normal.x

  if (Math.abs(det) < 1e-8) {
    return null; // Ray is parallel to triangle surface
  }

  const invDet = 1.0 / det;

  const tvecY = rayOriginY - v0.y;
  const tvecZ = rayOriginZ - v0.z;

  const u = (tvecY * pvecY + tvecZ * pvecZ) * invDet;
  if (u < -1e-4 || u > 1.0 + 1e-4) {
    return null;
  }

  // Cross(tvec, e1) . D
  const qvecX = tvecY * e1z - tvecZ * e1y;
  const v = qvecX * invDet;
  if (v < -1e-4 || u + v > 1.0 + 1e-4) {
    return null;
  }

  // Compute exact X coordinate on triangle plane
  const normalX = e1y * e2z - e1z * e2y;
  const normalY = e1z * e2x - e1x * e2z;
  const normalZ = e1x * e2y - e1y * e2x;

  const hitX = v0.x - (normalY * tvecY + normalZ * tvecZ) / normalX;
  return hitX;
}

/**
 * High-precision 3D Voxelizer for modular interlocking bricks.
 * Preserves true geometric holes (rings, toruses, tubes, arches) and fills solid walls.
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

  // Extract triangles
  const triangles: { v0: THREE.Vector3; v1: THREE.Vector3; v2: THREE.Vector3 }[] = [];
  const triMin = new THREE.Vector3();
  const triMax = new THREE.Vector3();
  const cellMin = new THREE.Vector3();
  const cellMax = new THREE.Vector3();

  for (let t = 0; t < numTriangles; t++) {
    const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, t * 3);
    const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, t * 3 + 1);
    const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, t * 3 + 2);
    triangles.push({ v0, v1, v2 });

    // 1. Surface Voxelization: Triangle-AABB intersection test
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
            resultGrid[idx] = 1;
          }
        }
      }
    }
  }

  // 2. Solid Voxelization via Scanline Ray-Parity (Properly Preserves Geometric Holes)
  if (settings.fillMode === 'solid') {
    for (let gz = 0; gz < dimZ_layers; gz++) {
      const rayY = bbox.min.y + (gz + 0.5) * effPitchY;

      for (let gy = 0; gy < dimY_depth; gy++) {
        const rayZ = bbox.min.z + (gy + 0.5) * effPitchZ;

        // Collect all intersection X coordinates along this ray
        const hits: number[] = [];

        for (let t = 0; t < triangles.length; t++) {
          const hitX = rayIntersectTriangleX(rayY, rayZ, triangles[t].v0, triangles[t].v1, triangles[t].v2);
          if (hitX !== null) {
            hits.push(hitX);
          }
        }

        if (hits.length > 0) {
          hits.sort((a, b) => a - b);

          // Cluster and deduplicate hits (removing double-hits on shared edges/vertices)
          const uniqueHits: number[] = [];
          for (let i = 0; i < hits.length; i++) {
            if (
              uniqueHits.length === 0 ||
              Math.abs(hits[i] - uniqueHits[uniqueHits.length - 1]) > effPitchX * 0.25
            ) {
              uniqueHits.push(hits[i]);
            }
          }

          // Ray-parity intervals: (hit[0], hit[1]), (hit[2], hit[3]), etc.
          for (let i = 0; i < uniqueHits.length - 1; i += 2) {
            const startX = uniqueHits[i];
            const endX = uniqueHits[i + 1];

            const startGX = Math.max(0, Math.floor((startX - bbox.min.x) / effPitchX));
            const endGX = Math.min(dimX - 1, Math.floor((endX - bbox.min.x) / effPitchX));

            for (let gx = startGX; gx <= endGX; gx++) {
              resultGrid[getIndex(gx, gy, gz)] = 1;
            }
          }
        }
      }
    }
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
