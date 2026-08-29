import * as THREE from 'three';
import { Vector3D, BoundingBox3D } from '../types/brick';

/**
 * Check if a 3D triangle intersects an Axis-Aligned Bounding Box (AABB).
 * Implements the Fast 3D Triangle-Box Overlap Algorithm based on the Separating Axis Theorem (SAT).
 */
export function triangleIntersectsAABB(
  boxMin: THREE.Vector3,
  boxMax: THREE.Vector3,
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3
): boolean {
  const boxCenter = new THREE.Vector3().addVectors(boxMin, boxMax).multiplyScalar(0.5);
  const boxHalfSize = new THREE.Vector3().subVectors(boxMax, boxMin).multiplyScalar(0.5);

  // Translate triangle to box center coordinates
  const a0 = new THREE.Vector3().subVectors(v0, boxCenter);
  const a1 = new THREE.Vector3().subVectors(v1, boxCenter);
  const a2 = new THREE.Vector3().subVectors(v2, boxCenter);

  // Triangle edge vectors
  const e0 = new THREE.Vector3().subVectors(a1, a0);
  const e1 = new THREE.Vector3().subVectors(a2, a1);
  const e2 = new THREE.Vector3().subVectors(a0, a2);

  // Test 9 axes from cross products between box axes and triangle edges
  const f0 = new THREE.Vector3(Math.abs(e0.x), Math.abs(e0.y), Math.abs(e0.z));
  const f1 = new THREE.Vector3(Math.abs(e1.x), Math.abs(e1.y), Math.abs(e1.z));
  const f2 = new THREE.Vector3(Math.abs(e2.x), Math.abs(e2.y), Math.abs(e2.z));

  // Axis tests
  let p0: number, p1: number, p2: number, min: number, max: number, rad: number;

  // Axis Test 1: Cross(X, e0)
  p0 = e0.z * a0.y - e0.y * a0.z;
  p2 = e0.z * a2.y - e0.y * a2.z;
  min = Math.min(p0, p2);
  max = Math.max(p0, p2);
  rad = f0.z * boxHalfSize.y + f0.y * boxHalfSize.z;
  if (min > rad || max < -rad) return false;

  // Axis Test 2: Cross(Y, e0)
  p0 = -e0.z * a0.x + e0.x * a0.z;
  p2 = -e0.z * a2.x + e0.x * a2.z;
  min = Math.min(p0, p2);
  max = Math.max(p0, p2);
  rad = f0.z * boxHalfSize.x + f0.x * boxHalfSize.z;
  if (min > rad || max < -rad) return false;

  // Axis Test 3: Cross(Z, e0)
  p0 = e0.y * a0.x - e0.x * a0.y;
  p1 = e0.y * a1.x - e0.x * a1.y;
  min = Math.min(p0, p1);
  max = Math.max(p0, p1);
  rad = f0.y * boxHalfSize.x + f0.x * boxHalfSize.y;
  if (min > rad || max < -rad) return false;

  // Axis Test 4: Cross(X, e1)
  p0 = e1.z * a0.y - e1.y * a0.z;
  p1 = e1.z * a1.y - e1.y * a1.z;
  min = Math.min(p0, p1);
  max = Math.max(p0, p1);
  rad = f1.z * boxHalfSize.y + f1.y * boxHalfSize.z;
  if (min > rad || max < -rad) return false;

  // Axis Test 5: Cross(Y, e1)
  p0 = -e1.z * a0.x + e1.x * a0.z;
  p1 = -e1.z * a1.x + e1.x * a1.z;
  min = Math.min(p0, p1);
  max = Math.max(p0, p1);
  rad = f1.z * boxHalfSize.x + f1.x * boxHalfSize.z;
  if (min > rad || max < -rad) return false;

  // Axis Test 6: Cross(Z, e1)
  p1 = e1.y * a1.x - e1.x * a1.y;
  p2 = e1.y * a2.x - e1.x * a2.y;
  min = Math.min(p1, p2);
  max = Math.max(p1, p2);
  rad = f1.y * boxHalfSize.x + f1.x * boxHalfSize.y;
  if (min > rad || max < -rad) return false;

  // Axis Test 7: Cross(X, e2)
  p0 = e2.z * a0.y - e2.y * a0.z;
  p1 = e2.z * a1.y - e2.y * a1.z;
  min = Math.min(p0, p1);
  max = Math.max(p0, p1);
  rad = f2.z * boxHalfSize.y + f2.y * boxHalfSize.z;
  if (min > rad || max < -rad) return false;

  // Axis Test 8: Cross(Y, e2)
  p0 = -e2.z * a0.x + e2.x * a0.z;
  p1 = -e2.z * a1.x + e2.x * a1.z;
  min = Math.min(p0, p1);
  max = Math.max(p0, p1);
  rad = f2.z * boxHalfSize.x + f2.x * boxHalfSize.z;
  if (min > rad || max < -rad) return false;

  // Axis Test 9: Cross(Z, e2)
  p0 = e2.y * a0.x - e2.x * a0.y;
  p2 = e2.y * a2.x - e2.x * a2.y;
  min = Math.min(p0, p2);
  max = Math.max(p0, p2);
  rad = f2.y * boxHalfSize.x + f2.x * boxHalfSize.y;
  if (min > rad || max < -rad) return false;

  // Test 3 AABB face axes (X, Y, Z)
  if (Math.max(a0.x, a1.x, a2.x) < -boxHalfSize.x || Math.min(a0.x, a1.x, a2.x) > boxHalfSize.x) return false;
  if (Math.max(a0.y, a1.y, a2.y) < -boxHalfSize.y || Math.min(a0.y, a1.y, a2.y) > boxHalfSize.y) return false;
  if (Math.max(a0.z, a1.z, a2.z) < -boxHalfSize.z || Math.min(a0.z, a1.z, a2.z) > boxHalfSize.z) return false;

  // Test Triangle Normal Plane
  const normal = new THREE.Vector3().crossVectors(e0, e1);
  const d = -normal.dot(a0);
  const minNormal = new THREE.Vector3();
  const maxNormal = new THREE.Vector3();

  for (const axis of ['x', 'y', 'z'] as const) {
    if (normal[axis] > 0) {
      minNormal[axis] = -boxHalfSize[axis];
      maxNormal[axis] = boxHalfSize[axis];
    } else {
      minNormal[axis] = boxHalfSize[axis];
      maxNormal[axis] = -boxHalfSize[axis];
    }
  }

  if (normal.dot(minNormal) + d > 0) return false;
  if (normal.dot(maxNormal) + d < 0) return false;

  return true;
}

export function computeGeometryBoundingBox(geometry: THREE.BufferGeometry): BoundingBox3D {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  return {
    min: { x: bb.min.x, y: bb.min.y, z: bb.min.z },
    max: { x: bb.max.x, y: bb.max.y, z: bb.max.z },
    size: {
      x: bb.max.x - bb.min.x,
      y: bb.max.y - bb.min.y,
      z: bb.max.z - bb.min.z,
    },
  };
}
