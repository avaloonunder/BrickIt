import JSZip from 'jszip';
import * as THREE from 'three';
import { BrickInstance, SlicerExportSettings } from '../types/brick';
import { createModularBrickGeometry } from '../core/brickGeometry';
import { UNIT_PITCH_XY_MM, UNIT_PITCH_Z_MM } from '../constants/brickCatalog';

/**
 * Generates a complete 3MF project package compatible with BambuStudio, OrcaSlicer, and standard 3MF viewers.
 * Preserves multi-color assignments, part morphology names, and slicer metadata.
 */
export async function exportTo3MF(
  bricks: BrickInstance[],
  settings: SlicerExportSettings,
  projectName: string = 'BrickCraft_Model'
): Promise<Blob> {
  const zip = new JSZip();

  // 1. Extract unique colors and build colorgroup index
  const uniqueColorsMap = new Map<string, { hex: string; name: string; index: number; bambuSlot: number }>();
  let colorIndex = 0;

  bricks.forEach((b) => {
    const hex = b.color.hex.toUpperCase();
    if (!uniqueColorsMap.has(hex)) {
      uniqueColorsMap.set(hex, {
        hex,
        name: b.color.name || `Color_${hex}`,
        index: colorIndex,
        bambuSlot: b.color.bambuSlot || (colorIndex + 1),
      });
      colorIndex++;
    }
  });

  // 2. Generate XML for [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/xml"/>
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  // 3. Generate XML for _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  zip.file('_rels/.rels', rootRelsXml);

  // 4. Generate 3D/3dmodel.model
  const modelXml = generate3DModelXml(bricks, uniqueColorsMap, settings, projectName);
  zip.file('3D/3dmodel.model', modelXml);

  // 5. Generate BambuStudio / OrcaSlicer Configs in Metadata/
  const modelSettingsConfig = generateModelSettingsConfig(bricks, uniqueColorsMap);
  zip.file('Metadata/model_settings.config', modelSettingsConfig);

  const projectSettingsConfig = generateProjectSettingsConfig(uniqueColorsMap);
  zip.file('Metadata/project_settings.config', projectSettingsConfig);

  // Generate ZIP blob
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Builds the standard 3MF XML model file with multi-color resources and geometry.
 */
function generate3DModelXml(
  bricks: BrickInstance[],
  colorsMap: Map<string, { hex: string; name: string; index: number; bambuSlot: number }>,
  settings: SlicerExportSettings,
  projectName: string
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">
  <metadata name="Title">${escapeXml(projectName)}</metadata>
  <metadata name="Designer">BrickCraft 3D Generator</metadata>
  <metadata name="Application">BrickCraft Modular Engine</metadata>
  <resources>
    <m:colorgroup id="1">
`;

  // Color definitions in resources
  colorsMap.forEach((c) => {
    const hex8 = c.hex.startsWith('#') ? `${c.hex.substring(1)}FF` : `${c.hex}FF`;
    xml += `      <m:color color="#${hex8}" name="${escapeXml(c.name)}"/>\n`;
  });

  xml += `    </m:colorgroup>\n`;

  // Pre-generate unique brick meshes and add them as objects
  // Each unique (sizeX, sizeY, sizeZ, color) combination can be an object
  const objectsXml: string[] = [];
  const buildItemsXml: string[] = [];

  let nextObjectId = 2; // ID 1 is the colorgroup
  const meshCache = new Map<string, number>(); // key -> objectId

  // Flat nesting tracking if mode is 'plate_nested'
  let curPlateX = 20;
  let curPlateY = 20;
  let maxRowHeight = 0;
  const bedMaxX = settings.bedSizeX || 240;
  const spacing = settings.bedSpacing || 4.0;

  bricks.forEach((brick, idx) => {
    const colorInfo = colorsMap.get(brick.color.hex.toUpperCase()) || { index: 0 };
    const pindex = colorInfo.index;

    // Cache key for geometry
    const geoKey = `${brick.sizeX}x${brick.sizeY}x${brick.sizeZ}_c${pindex}`;
    let objectId: number;

    if (!meshCache.has(geoKey)) {
      objectId = nextObjectId++;
      meshCache.set(geoKey, objectId);

      const geo = createModularBrickGeometry({
        sizeX: brick.sizeX,
        sizeY: brick.sizeY,
        sizeZ: brick.sizeZ,
        toleranceOffset: settings.toleranceOffsetMm || 0.15,
      });

      const nonIndexed = geo.toNonIndexed();
      const posAttr = nonIndexed.getAttribute('position') as THREE.BufferAttribute;
      const numVertices = posAttr.count;

      let meshXml = `    <object id="${objectId}" type="model" name="Brick_${brick.morphologyId}" pid="1" pindex="${pindex}">\n`;
      meshXml += `      <mesh>\n        <vertices>\n`;

      for (let i = 0; i < numVertices; i++) {
        const vx = posAttr.getX(i).toFixed(3);
        const vy = posAttr.getY(i).toFixed(3);
        const vz = posAttr.getZ(i).toFixed(3);
        meshXml += `          <vertex x="${vx}" y="${vy}" z="${vz}"/>\n`;
      }

      meshXml += `        </vertices>\n        <triangles>\n`;
      const numTriangles = numVertices / 3;
      for (let t = 0; t < numTriangles; t++) {
        const v1 = t * 3;
        const v2 = t * 3 + 1;
        const v3 = t * 3 + 2;
        meshXml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="1" p1="${pindex}"/>\n`;
      }

      meshXml += `        </triangles>\n      </mesh>\n    </object>\n`;
      objectsXml.push(meshXml);
    } else {
      objectId = meshCache.get(geoKey)!;
    }

    // Determine 3D transform position
    let tx: number, ty: number, tz: number;

    if (settings.exportMode === 'plate_nested') {
      // Flat bed arrangement
      const brickDimX = brick.sizeX * UNIT_PITCH_XY_MM;
      const brickDimY = brick.sizeY * UNIT_PITCH_XY_MM;

      if (curPlateX + brickDimX > bedMaxX) {
        curPlateX = 20;
        curPlateY += maxRowHeight + spacing;
        maxRowHeight = 0;
      }

      tx = curPlateX + brickDimX / 2;
      ty = curPlateY + brickDimY / 2;
      tz = 0;

      curPlateX += brickDimX + spacing;
      if (brickDimY > maxRowHeight) {
        maxRowHeight = brickDimY;
      }
    } else {
      // Assembled model position
      tx = (brick.gridX + brick.sizeX / 2) * UNIT_PITCH_XY_MM;
      ty = (brick.gridY + brick.sizeY / 2) * UNIT_PITCH_XY_MM;
      tz = brick.gridZ * UNIT_PITCH_Z_MM;
    }

    // 3MF Transform matrix: [1 0 0  0 1 0  0 0 1  tx ty tz]
    const transform = `1 0 0 0 1 0 0 0 1 ${tx.toFixed(2)} ${ty.toFixed(2)} ${tz.toFixed(2)}`;
    buildItemsXml.push(`    <item objectid="${objectId}" transform="${transform}" partid="${idx + 1}"/>\n`);
  });

  xml += objectsXml.join('');
  xml += `  </resources>\n  <build>\n`;
  xml += buildItemsXml.join('');
  xml += `  </build>\n</model>`;

  return xml;
}

/**
 * Generates Bambu Studio / OrcaSlicer model_settings.config XML.
 */
function generateModelSettingsConfig(
  bricks: BrickInstance[],
  colorsMap: Map<string, { hex: string; name: string; index: number; bambuSlot: number }>
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="Plate 1"/>
    <metadata key="locked" value="false"/>
  </plate>
  <objects>
`;

  bricks.forEach((brick, idx) => {
    const colorInfo = colorsMap.get(brick.color.hex.toUpperCase()) || { bambuSlot: 1 };
    xml += `    <object id="${idx + 1}">
      <metadata key="name" value="${brick.morphologyId}_${brick.color.name}_L${brick.layerIndex + 1}"/>
      <metadata key="extruder" value="${colorInfo.bambuSlot}"/>
      <metadata key="layer_height" value="0.2"/>
    </object>\n`;
  });

  xml += `  </objects>
</config>`;

  return xml;
}

/**
 * Generates project settings JSON for Bambu/OrcaSlicer AMS slot colors.
 */
function generateProjectSettingsConfig(
  colorsMap: Map<string, { hex: string; name: string; index: number; bambuSlot: number }>
): string {
  const filaments: { [key: string]: any } = {};

  colorsMap.forEach((c) => {
    filaments[`filament_${c.bambuSlot}`] = {
      color: c.hex,
      type: 'PLA',
      name: c.name,
    };
  });

  return JSON.stringify(
    {
      version: '1.0.0',
      generator: 'BrickCraft 3D',
      filaments,
    },
    null,
    2
  );
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
