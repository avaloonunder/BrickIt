import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { BrickInstance, VoxelGrid, FilamentColor } from '../types/brick';
import { createModularBrickGeometry } from '../core/brickGeometry';
import { UNIT_PITCH_XY_MM, UNIT_PITCH_Z_MM } from '../constants/brickCatalog';
import { Eye, EyeOff, Layers, Maximize2, RotateCcw, Palette } from 'lucide-react';

export interface Viewport3DHandle {
  captureSnapshot: () => string;
  focusModel: () => void;
}

interface Viewport3DProps {
  originalGeometry: THREE.BufferGeometry | null;
  voxelGrid: VoxelGrid | null;
  bricks: BrickInstance[];
  selectedColor?: FilamentColor;
  paintMode?: boolean;
  onBrickColorChange?: (brickId: string, color: FilamentColor) => void;
  activeLayerFilter?: number | null; // null = all layers, number = only up to layer N
  currentStepIndex?: number | null; // For assembly guide playback
  showOriginalMesh?: boolean;
  showGridFloor?: boolean;
  explodeFactor?: number; // 0.0 to 2.0
}

export const Viewport3D = forwardRef<Viewport3DHandle, Viewport3DProps>(({
  originalGeometry,
  voxelGrid,
  bricks,
  selectedColor,
  paintMode = false,
  onBrickColorChange,
  activeLayerFilter = null,
  currentStepIndex = null,
  showOriginalMesh = false,
  showGridFloor = true,
  explodeFactor = 0,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Groups for 3D objects
  const bricksGroupRef = useRef<THREE.Group>(new THREE.Group());
  const originalMeshGroupRef = useRef<THREE.Group>(new THREE.Group());
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Interaction & Orbit state
  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 120,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
  });

  const [hoveredBrick, setHoveredBrick] = useState<BrickInstance | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mousePosRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Expose snapshot & focus methods to parent
  useImperativeHandle(ref, () => ({
    captureSnapshot: () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        return rendererRef.current.domElement.toDataURL('image/png');
      }
      return '';
    },
    focusModel: () => {
      resetCamera();
    },
  }));

  const resetCamera = () => {
    cameraSphericalRef.current = {
      radius: 140,
      theta: Math.PI / 4,
      phi: Math.PI / 3,
    };
    cameraTargetRef.current.set(0, 10, 0);
    updateCameraPosition();
  };

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = cameraSphericalRef.current;
    const target = cameraTargetRef.current;

    cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = target.y + radius * Math.cos(phi);
    cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(target);
  };

  // 1. Initialize Scene & Three.js Canvas
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // slate-900
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 2000);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(100, 150, 100);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90caf9, 0.4);
    dirLight2.position.set(-100, 50, -100);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.4);
    scene.add(hemiLight);

    // Add object groups
    scene.add(bricksGroupRef.current);
    scene.add(originalMeshGroupRef.current);

    // Floor Grid
    const gridHelper = new THREE.GridHelper(256, 32, 0x3b82f6, 0x334155);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Render loop
    let animationFrameId: number;
    const render = () => {
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // 2. Update Grid Floor Visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGridFloor;
    }
  }, [showGridFloor]);

  // 3. Update Original STL Mesh Geometry (Scaled & Aligned with Brick Model)
  useEffect(() => {
    const group = originalMeshGroupRef.current;
    group.clear();

    if (originalGeometry && showOriginalMesh && voxelGrid && bricks.length > 0) {
      originalGeometry.computeBoundingBox();
      const bbox = originalGeometry.boundingBox!;
      const size = new THREE.Vector3();
      bbox.getSize(size);

      // Compute brick assembly bounds in scene units
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      bricks.forEach((b) => {
        const bx = b.gridX * UNIT_PITCH_XY_MM;
        const bz = b.gridY * UNIT_PITCH_XY_MM;
        const bx2 = (b.gridX + b.sizeX) * UNIT_PITCH_XY_MM;
        const bz2 = (b.gridY + b.sizeY) * UNIT_PITCH_XY_MM;

        minX = Math.min(minX, bx);
        maxX = Math.max(maxX, bx2);
        minZ = Math.min(minZ, bz);
        maxZ = Math.max(maxZ, bz2);
      });

      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;

      // Scale factor: mapping original mesh dimensions to voxelized dimensions
      const totalVoxelWidth = voxelGrid.dimX * voxelGrid.pitchX;
      const totalVoxelHeight = voxelGrid.dimZ * voxelGrid.pitchZ;
      const totalVoxelDepth = voxelGrid.dimY * voxelGrid.pitchY;

      const scaleX = size.x > 0 ? totalVoxelWidth / size.x : 1.0;
      const scaleY = size.y > 0 ? totalVoxelHeight / size.y : 1.0;
      const scaleZ = size.z > 0 ? totalVoxelDepth / size.z : 1.0;

      const mat = new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.4,
        wireframe: false,
        side: THREE.DoubleSide,
        roughness: 0.3,
        metalness: 0.1,
      });

      // Wireframe overlay for crisp contour comparison
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      });

      const mesh = new THREE.Mesh(originalGeometry, mat);
      const wireMesh = new THREE.Mesh(originalGeometry, wireMat);
      mesh.add(wireMesh);

      // Scale mesh to match brick model proportions
      mesh.scale.set(scaleX, scaleY, scaleZ);

      // Position mesh so it aligns with the brick center in X/Z and starts at Y=0
      mesh.position.set(
        -bbox.min.x * scaleX - centerX,
        -bbox.min.y * scaleY,
        -bbox.min.z * scaleZ - centerZ
      );

      mesh.castShadow = false;
      group.add(mesh);
    }
  }, [originalGeometry, showOriginalMesh, voxelGrid, bricks]);

  // 4. Update Modular Bricks 3D Geometry
  useEffect(() => {
    const group = bricksGroupRef.current;
    group.clear();

    if (!bricks || bricks.length === 0) return;

    // Calculate bounding center to center the entire assembly at (0, 0, 0)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let maxZ = 0;

    bricks.forEach((b) => {
      const bx = b.gridX * UNIT_PITCH_XY_MM;
      const by = b.gridY * UNIT_PITCH_XY_MM;
      const bx2 = (b.gridX + b.sizeX) * UNIT_PITCH_XY_MM;
      const by2 = (b.gridY + b.sizeY) * UNIT_PITCH_XY_MM;

      minX = Math.min(minX, bx);
      maxX = Math.max(maxX, bx2);
      minY = Math.min(minY, by);
      maxY = Math.max(maxY, by2);
      maxZ = Math.max(maxZ, b.layerIndex);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Material cache by color hex
    const materialCache = new Map<string, THREE.MeshStandardMaterial>();

    bricks.forEach((brick) => {
      // Layer filtering for assembly guide / slicing
      const isVisible = activeLayerFilter === null || brick.layerIndex <= activeLayerFilter;
      if (!isVisible) return;

      const isCurrentStepBrick = currentStepIndex !== null && (brick.layerIndex + 1 === currentStepIndex);
      const isPastLayer = currentStepIndex !== null && (brick.layerIndex + 1 < currentStepIndex);

      const colorHex = brick.color.hex;
      let matKey = colorHex;
      if (isPastLayer) matKey += '_ghost';
      if (isCurrentStepBrick) matKey += '_active';

      let material = materialCache.get(matKey);
      if (!material) {
        const color = new THREE.Color(colorHex);

        if (isPastLayer) {
          material = new THREE.MeshStandardMaterial({
            color: color.clone().multiplyScalar(0.7),
            transparent: true,
            opacity: 0.35,
            roughness: 0.5,
            metalness: 0.1,
          });
        } else if (isCurrentStepBrick) {
          material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.25,
            metalness: 0.05,
            emissive: color.clone().multiplyScalar(0.2),
          });
        } else {
          material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.3,
            metalness: 0.05,
          });
        }
        materialCache.set(matKey, material);
      }

      const geo = createModularBrickGeometry({
        sizeX: brick.sizeX,
        sizeY: brick.sizeY,
        sizeZ: brick.sizeZ,
        toleranceOffset: 0.12,
      });

      // Position brick
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = !isPastLayer;
      mesh.receiveShadow = true;

      // Coordinate mapping: Three.js Y is UP, Z is depth
      const posX = (brick.gridX + brick.sizeX / 2) * UNIT_PITCH_XY_MM - centerX;
      const posZ = (brick.gridY + brick.sizeY / 2) * UNIT_PITCH_XY_MM - centerY;

      // Apply exploded view offset
      const explodeY = brick.layerIndex * (explodeFactor * 12);
      const posY = brick.layerIndex * UNIT_PITCH_Z_MM + explodeY;

      mesh.position.set(posX, posY, posZ);
      mesh.userData = { brick };

      group.add(mesh);
    });
  }, [bricks, activeLayerFilter, currentStepIndex, explodeFactor]);

  // 5. Mouse Interaction: Orbit, Pan, Zoom, Hover & Click to Paint
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
    } else if (e.button === 2 || e.button === 1) {
      isPanningRef.current = true;
    }
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current) {
      // Orbit rotation
      cameraSphericalRef.current.theta -= deltaX * 0.008;
      cameraSphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI / 2 - 0.01, cameraSphericalRef.current.phi + deltaY * 0.008)
      );
      updateCameraPosition();
    } else if (isPanningRef.current) {
      // Pan target
      const panSpeed = 0.2;
      const forward = new THREE.Vector3();
      cameraRef.current?.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3(0, 1, 0);

      cameraTargetRef.current.addScaledVector(right, -deltaX * panSpeed);
      cameraTargetRef.current.addScaledVector(up, deltaY * panSpeed);
      updateCameraPosition();
    }

    // Raycast hover brick detection
    if (canvasRef.current && cameraRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mousePosRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(bricksGroupRef.current.children, true);

      if (intersects.length > 0) {
        let topObject: THREE.Object3D | null = intersects[0].object;
        while (topObject && !topObject.userData.brick && topObject.parent) {
          topObject = topObject.parent;
        }
        if (topObject && topObject.userData.brick) {
          setHoveredBrick(topObject.userData.brick);
        }
      } else {
        setHoveredBrick(null);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraSphericalRef.current.radius = Math.max(
      15,
      Math.min(1000, cameraSphericalRef.current.radius * zoomFactor)
    );
    updateCameraPosition();
  };

  const handleClick = () => {
    if (paintMode && hoveredBrick && selectedColor && onBrickColorChange) {
      onBrickColorChange(hoveredBrick.id, selectedColor);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full select-none cursor-grab active:cursor-grabbing overflow-hidden bg-slate-950"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating Toolbar Controls */}
      <div className="absolute top-4 left-4 flex flex-col space-y-2 z-10">
        <button
          onClick={resetCamera}
          title="Centrar Vista 3D"
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 backdrop-blur-md border border-slate-700 shadow-md transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Hover Info Badge */}
      {hoveredBrick && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-xl pointer-events-none text-xs z-10">
          <div className="flex items-center space-x-2 font-bold text-white mb-1">
            <span
              className="w-3 h-3 rounded-full border border-white/40"
              style={{ backgroundColor: hoveredBrick.color.hex }}
            />
            <span>{hoveredBrick.morphologyId} ({hoveredBrick.sizeX}×{hoveredBrick.sizeY})</span>
            <span className="text-slate-400 font-normal">#{hoveredBrick.id.split('_').pop()}</span>
          </div>
          <div className="text-slate-300 space-y-0.5 text-[11px]">
            <div>Capa: <span className="font-semibold text-blue-400">Nivel {hoveredBrick.layerIndex + 1}</span></div>
            <div>Color: <span className="font-semibold">{hoveredBrick.color.name}</span></div>
            <div>Posición: X={hoveredBrick.gridX}, Y={hoveredBrick.gridY}</div>
          </div>
          {paintMode && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-cyan-300 font-medium flex items-center space-x-1">
              <Palette className="w-3 h-3" />
              <span>Haz clic para pintar con {selectedColor?.name || 'color'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
