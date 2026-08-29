import * as THREE from 'three';

export interface SampleModel {
  id: string;
  name: string;
  category: string;
  icon: string;
  getGeometry: () => THREE.BufferGeometry;
}

export const SAMPLE_MODELS: SampleModel[] = [
  {
    id: 'heart_3d',
    name: 'Corazón 3D (Heart)',
    category: 'Formas',
    icon: '❤️',
    getGeometry: () => createHeartGeometry(),
  },
  {
    id: 'castle_tower',
    name: 'Torre de Castillo (Castle)',
    category: 'Arquitectura',
    icon: '🏰',
    getGeometry: () => createCastleGeometry(),
  },
  {
    id: 'pyramid',
    name: 'Pirámide Escalonada (Pyramid)',
    category: 'Monumentos',
    icon: '🏛️',
    getGeometry: () => createPyramidGeometry(),
  },
  {
    id: 'lowpoly_duck',
    name: 'Patito Low-Poly (Duck)',
    category: 'Animales',
    icon: '🦆',
    getGeometry: () => createDuckGeometry(),
  },
  {
    id: 'torus_knot',
    name: 'Nudo Toroidal (Torus Knot)',
    category: 'Matemáticas',
    icon: '🌀',
    getGeometry: () => {
      const geo = new THREE.TorusKnotGeometry(20, 6, 64, 16, 2, 3);
      geo.center();
      return geo;
    },
  },
];

function createHeartGeometry(): THREE.BufferGeometry {
  const x = 0, y = 0;
  const heartShape = new THREE.Shape();
  heartShape.moveTo(x + 5, y + 5);
  heartShape.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
  heartShape.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
  heartShape.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
  heartShape.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
  heartShape.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
  heartShape.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);

  const extrudeSettings = {
    depth: 10,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 2,
    bevelSize: 2,
    bevelThickness: 2,
  };

  const geo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
  geo.rotateX(Math.PI);
  geo.scale(2, 2, 2);
  geo.center();
  return geo;
}

function createCastleGeometry(): THREE.BufferGeometry {
  // Base cylinder + battlements + cone roof
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(15, 17, 30, 16);
  const baseMesh = new THREE.Mesh(baseGeo);
  baseMesh.position.y = 15;
  group.add(baseMesh);

  const parapetGeo = new THREE.CylinderGeometry(18, 18, 8, 16);
  const parapetMesh = new THREE.Mesh(parapetGeo);
  parapetMesh.position.y = 34;
  group.add(parapetMesh);

  const roofGeo = new THREE.ConeGeometry(19, 20, 16);
  const roofMesh = new THREE.Mesh(roofGeo);
  roofMesh.position.y = 48;
  group.add(roofMesh);

  // Convert merged group to buffer geometry
  const geometries: THREE.BufferGeometry[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const cloned = child.geometry.clone();
      cloned.applyMatrix4(child.matrix);
      geometries.push(cloned);
    }
  });

  // Combine geometries
  const merged = mergeBufferGeometries(geometries);
  merged.center();
  return merged;
}

function createPyramidGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const layers = 5;
  const baseSize = 40;

  for (let i = 0; i < layers; i++) {
    const size = baseSize * (1 - i / layers);
    const height = 8;
    const box = new THREE.BoxGeometry(size, height, size);
    box.translate(0, i * height + height / 2, 0);
    geometries.push(box);
  }

  const merged = mergeBufferGeometries(geometries);
  merged.center();
  return merged;
}

function createDuckGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.SphereGeometry(16, 8, 8);
  body.scale(1.3, 0.9, 1.0);
  body.translate(0, 12, 0);
  geometries.push(body);

  // Head
  const head = new THREE.SphereGeometry(10, 8, 8);
  head.translate(14, 25, 0);
  geometries.push(head);

  // Beak
  const beak = new THREE.ConeGeometry(5, 10, 6);
  beak.rotateZ(-Math.PI / 2);
  beak.translate(24, 24, 0);
  geometries.push(beak);

  // Tail
  const tail = new THREE.ConeGeometry(6, 12, 6);
  tail.rotateZ(Math.PI / 3);
  tail.translate(-16, 15, 0);
  geometries.push(tail);

  const merged = mergeBufferGeometries(geometries);
  merged.center();
  return merged;
}

function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalPositions = 0;
  let totalNormals = 0;

  geometries.forEach((g) => {
    const nonIndexed = g.toNonIndexed();
    totalPositions += nonIndexed.attributes.position.array.length;
    if (nonIndexed.attributes.normal) {
      totalNormals += nonIndexed.attributes.normal.array.length;
    }
  });

  const mergedPos = new Float32Array(totalPositions);
  const mergedNorm = new Float32Array(totalPositions);

  let posOffset = 0;
  geometries.forEach((g) => {
    const nonIndexed = g.toNonIndexed();
    const pos = nonIndexed.attributes.position.array;
    mergedPos.set(pos, posOffset);

    if (nonIndexed.attributes.normal) {
      mergedNorm.set(nonIndexed.attributes.normal.array, posOffset);
    }
    posOffset += pos.length;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  merged.computeVertexNormals();
  return merged;
}
