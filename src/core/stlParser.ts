import * as THREE from 'three';

/**
 * Parses binary or ASCII STL ArrayBuffer into a Three.js BufferGeometry.
 */
export function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  if (isBinarySTL(buffer)) {
    return parseBinarySTL(buffer);
  } else {
    const text = new TextDecoder('utf-8').decode(buffer);
    return parseAsciiSTL(text);
  }
}

function isBinarySTL(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;

  const reader = new DataView(buffer);
  const numFaces = reader.getUint32(80, true);
  const expectedSize = 84 + numFaces * 50;

  // If file size exactly matches the binary specification formula:
  if (Math.abs(expectedSize - buffer.byteLength) <= 2) {
    return true;
  }

  // Fallback: check if header starts with 'solid' and contains 'endsolid'
  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
  const headerStr = String.fromCharCode(...header).toLowerCase();
  if (headerStr.startsWith('solid')) {
    // Check if the entire content is ASCII text
    const sample = new Uint8Array(buffer, 0, Math.min(512, buffer.byteLength));
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] > 127) return true; // Binary character found
    }
    const fullText = new TextDecoder('utf-8').decode(buffer);
    if (fullText.includes('facet normal') || fullText.includes('endsolid')) {
      return false; // Valid ASCII STL
    }
  }

  return true; // Default to binary
}

function parseBinarySTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const reader = new DataView(buffer);
  const numFaces = reader.getUint32(80, true);

  const positions = new Float32Array(numFaces * 9);
  const normals = new Float32Array(numFaces * 9);

  let offset = 84;
  let posIdx = 0;

  for (let face = 0; face < numFaces; face++) {
    // Face normal
    const nx = reader.getFloat32(offset, true);
    const ny = reader.getFloat32(offset + 4, true);
    const nz = reader.getFloat32(offset + 8, true);
    offset += 12;

    // 3 Vertices (x, y, z each)
    for (let v = 0; v < 3; v++) {
      const vx = reader.getFloat32(offset, true);
      const vy = reader.getFloat32(offset + 4, true);
      const vz = reader.getFloat32(offset + 8, true);
      offset += 12;

      positions[posIdx] = vx;
      positions[posIdx + 1] = vy;
      positions[posIdx + 2] = vz;

      normals[posIdx] = nx;
      normals[posIdx + 1] = ny;
      normals[posIdx + 2] = nz;

      posIdx += 3;
    }

    offset += 2; // 2 bytes attribute byte count
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

  // Compute vertex normals if face normals are zero/invalid
  geometry.computeVertexNormals();
  geometry.center();

  return geometry;
}

function parseAsciiSTL(text: string): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const normalPattern = /facet\s+normal\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const vertexPattern = /vertex\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

  let normalMatch: RegExpExecArray | null;
  let vertexMatch: RegExpExecArray | null;

  while ((normalMatch = normalPattern.exec(text)) !== null) {
    const nx = parseFloat(normalMatch[1]);
    const ny = parseFloat(normalMatch[2]);
    const nz = parseFloat(normalMatch[3]);

    for (let i = 0; i < 3; i++) {
      vertexMatch = vertexPattern.exec(text);
      if (vertexMatch) {
        positions.push(parseFloat(vertexMatch[1]), parseFloat(vertexMatch[2]), parseFloat(vertexMatch[3]));
        normals.push(nx, ny, nz);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  geometry.center();

  return geometry;
}
