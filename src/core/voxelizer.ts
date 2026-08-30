import * as THREE from 'three';
import { VoxelGrid, VoxelizerSettings } from '../types/brick';
import { triangleIntersectsAABB } from './math3d';

/**
 * Ray-Triangle intersection test along the +X ray at a fixed (Y, Z).
 * Returns the intersection X coordinate if the ray hits the triangle, or null.
 */
function rayIntersectTriangleX(
  rayOriginY: number,
  rayOriginZ: number,
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3
): number | null {
  // Pre-filter: Check 2D bounding box in (Y, Z) plane
  const minY = Math.min(v0.y, v1.y, v2.y);
  const maxY = Math.max(v0.y, v1.y, v2.y);
  const minZ = Math.min(v0.z, v1.z, v2.z);
  const maxZ = Math.max(v0.z, v1.z, v2.z);

  if (rayOriginY < minY || rayOriginY > maxY || rayOriginZ < minZ || rayOriginZ > maxZ) {
    return null;
  }

  // Edge vectors
  const edge1 = new THREE.Vector3().subVectors(v1, v0);
  const edge2 = new THREE.Vector3().subVectors(v2, v0);

  // Normal vector of triangle
  const normal = new THREE.Vector3().crossVectors(edge1, edge2);

  // If triangle is parallel to X axis (normal.x ~= 0), ray cannot cleanly enter/exit
  if (Math.abs(normal.x) < 1e-7) {
    return null;
  }

  // Ray direction is (1, 0, 0)
  // Solve for t: normal . (v0 - rayOrigin) / normal.x
  const t = (normal.x * v0.x + normal.y * (v0.y - rayOriginY) + normal.z * (v0.z - rayOriginZ)) / normal.x;

  const hitPoint = new THREE.Vector3(t, rayOriginY, rayOriginZ);

  // Check if hitPoint is inside the 3D triangle using barycentric coordinates
  const v0ToHit = new THREE.Vector3().subVectors(hitPoint, v0);
  const dot00 = edge1.dot(edge1);
  const dot01 = edge1.dot(edge2);
  const dot02 = edge1.dot(v0ToHit);
  const dot11 = edge2.dot(edge2);
  const dot12 = edge2.dot(v0ToHit);

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-9) return null;

  const u = (dot11 * dot02 - dot01 * dot12) / denom;
  const v = (dot00 * dot12 - dot01 * dot02) / denom;

  if (u >= -1e-4 && v >= -1e-4 && u + v <= 1.0 + 1e-4) {
    return t;
  }

  return null;
}

/**
 * High-precision 3D Voxelizer for modular interlocking bricks.
 * Uses 3D Scanline Ray-Parity intersection for 100% solid, hole-free models.
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

  // Compute scale based on target resolution
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
  const effPitchY = pitchY / scale; // vertical (mesh Y)
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

  // Extract all triangles into memory for fast raycasting
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

    // 1. Surface Voxelization: Test triangle against overlapping voxel boxes
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

  // 2. Solid Voxelization via Multi-Ray Scanline Intersections
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

          // Remove duplicate hits (e.g. ray passing through shared triangle edge)
          const uniqueHits: number[] = [];
          for (let i = 0; i < hits.length; i++) {
            if (uniqueHits.length === 0 || Math.abs(hits[i] - uniqueHits[uniqueHits.length - 1]) > 1e-3) {
              uniqueHits.push(hits[i]);
            }
          }

          // Fill spans between pairs: (hit[0], hit[1]), (hit[2], hit[3]), etc.
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

        // Fallback: 2D span filling between surface voxels on this row to ensure 100% solidity
        let firstSurface = -1;
        let lastSurface = -1;
        for (let gx = 0; gx < dimX; gx++) {
          if (surfaceGrid[getIndex(gx, gy, gz)] === 1) {
            if (firstSurface === -1) firstSurface = gx;
            lastSurface = gx;
          }
        }
        if (firstSurface !== -1 && lastSurface !== -1 && lastSurface > firstSurface) {
          for (let gx = firstSurface; gx <= lastSurface; gx++) {
            resultGrid[getIndex(gx, gy, gz)] = 1;
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
