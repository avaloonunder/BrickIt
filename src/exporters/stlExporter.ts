import JSZip from 'jszip';
import * as THREE from 'three';
import { BrickInstance } from '../types/brick';
import { createModularBrickGeometry } from '../core/brickGeometry';
import { UNIT_PITCH_XY_MM, UNIT_PITCH_Z_MM } from '../constants/brickCatalog';

/**
 * Converts a Three.js BufferGeometry to ASCII STL string format.
 */
export function geometryToAsciiSTL(geometry: THREE.BufferGeometry, name: string = 'brick'): string {
  const nonIndexed = geometry.toNonIndexed();
  nonIndexed.computeVertexNormals();

  const posAttr = nonIndexed.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = nonIndexed.getAttribute('normal') as THREE.BufferAttribute;

  let stl = `solid ${name}\n`;
  const count = posAttr.count;

  for (let i = 0; i < count; i += 3) {
    const nx = normAttr.getX(i).toExponential(6);
    const ny = normAttr.getY(i).toExponential(6);
    const nz = normAttr.getZ(i).toExponential(6);

    stl += `  facet normal ${nx} ${ny} ${nz}\n    outer loop\n`;

    for (let v = 0; v < 3; v++) {
      const vx = posAttr.getX(i + v).toExponential(6);
      const vy = posAttr.getY(i + v).toExponential(6);
      const vz = posAttr.getZ(i + v).toExponential(6);
      stl += `      vertex ${vx} ${vy} ${vz}\n`;
    }

    stl += `    endloop\n  endfacet\n`;
  }

  stl += `endsolid ${name}\n`;
  return stl;
}

/**
 * Exports all bricks as a merged STL or individual STL zip archive.
 */
export async function exportToSTLZip(bricks: BrickInstance[], projectName: string = 'BrickCraft_Model'): Promise<Blob> {
  const zip = new JSZip();

  // Export unique brick morphology library
  const morphologyMap = new Map<string, BrickInstance>();
  bricks.forEach((b) => {
    if (!morphologyMap.has(b.morphologyId)) {
      morphologyMap.set(b.morphologyId, b);
    }
  });

  morphologyMap.forEach((brick, morphId) => {
    const geo = createModularBrickGeometry({
      sizeX: brick.sizeX,
      sizeY: brick.sizeY,
      sizeZ: brick.sizeZ,
    });
    const stlStr = geometryToAsciiSTL(geo, morphId);
    zip.file(`Morphologies/${morphId}.stl`, stlStr);
  });

  // Export assembled whole model STL
  const assembledGeos: THREE.BufferGeometry[] = [];
  bricks.forEach((b) => {
    const geo = createModularBrickGeometry({
      sizeX: b.sizeX,
      sizeY: b.sizeY,
      sizeZ: b.sizeZ,
    });
    const tx = (b.gridX + b.sizeX / 2) * UNIT_PITCH_XY_MM;
    const ty = (b.gridY + b.sizeY / 2) * UNIT_PITCH_XY_MM;
    const tz = b.gridZ * UNIT_PITCH_Z_MM;
    geo.translate(tx, ty, tz);
    assembledGeos.push(geo);
  });

  const merged = mergeBufferGeometries(assembledGeos);
  const fullModelStl = geometryToAsciiSTL(merged, projectName);
  zip.file(`${projectName}_Assembled.stl`, fullModelStl);

  return await zip.generateAsync({ type: 'blob' });
}

function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
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
