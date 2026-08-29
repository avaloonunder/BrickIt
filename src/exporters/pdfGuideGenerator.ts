import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BrickInstance, ModelStatistics, AssemblyStep } from '../types/brick';
import { BRICK_CATALOG } from '../constants/brickCatalog';

export interface PDFGuideOptions {
  projectName: string;
  statistics: ModelStatistics;
  steps: AssemblyStep[];
  modelImageBase64?: string; // Optional cover image snapshot
  stepImagesBase64?: Map<number, string>; // Optional step snapshots
}

/**
 * Generates a step-by-step visual PDF assembly guide for the modular brick model.
 */
export async function generateAssemblyGuidePDF(options: PDFGuideOptions): Promise<Blob> {
  const { projectName, statistics, steps, modelImageBase64, stepImagesBase64 } = options;

  // Create A4 Landscape PDF for clear horizontal diagrams
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  drawCoverPage(doc, projectName, statistics, modelImageBase64, pageWidth, pageHeight);

  // ==========================================
  // PAGE 2: BILL OF MATERIALS (BOM) / CATALOG
  // ==========================================
  doc.addPage();
  drawBomPage(doc, statistics, pageWidth, pageHeight);

  // ==========================================
  // PAGES 3+: STEP-BY-STEP ASSEMBLY
  // ==========================================
  for (let i = 0; i < steps.length; i++) {
    doc.addPage();
    const step = steps[i];
    const stepImg = stepImagesBase64 ? stepImagesBase64.get(step.stepIndex) : undefined;
    drawStepPage(doc, step, i + 1, steps.length, stepImg, pageWidth, pageHeight);
  }

  // ==========================================
  // FINAL PAGE: COMPLETION
  // ==========================================
  doc.addPage();
  drawCompletionPage(doc, projectName, statistics, modelImageBase64, pageWidth, pageHeight);

  return doc.output('blob');
}

function drawCoverPage(
  doc: jsPDF,
  projectName: string,
  stats: ModelStatistics,
  image: string | undefined,
  w: number,
  h: number
) {
  // Background gradient banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, w, h, 'F');

  // Accent top bar
  doc.setFillColor(59, 130, 246); // blue-500
  doc.rect(0, 0, w, 8, 'F');

  // Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text('GUÍA DE MONTAJE MODULAR', 20, 26);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Manual de Construcción Paso a Paso para Bloques Interconectables', 20, 34);

  // Model Name Box
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(20, 42, 130, 22, 3, 3, 'F');
  doc.setTextColor(59, 130, 246);
  doc.setFontSize(10);
  doc.text('PROYECTO:', 26, 50);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(projectName || 'Modelo 3D Modular', 26, 59);

  // Key Statistics Grid (Left Column)
  const statsList = [
    { label: 'Total de Piezas', val: `${stats.totalBricks} bloques` },
    { label: 'Capas de Altura', val: `${stats.layerCount} niveles` },
    { label: 'Dimensiones', val: `${Math.round(stats.dimensionsMm.x)} × ${Math.round(stats.dimensionsMm.y)} × ${Math.round(stats.dimensionsMm.z)} mm` },
    { label: 'Peso Estimado', val: `${stats.estimatedWeightGrams} g (PLA)` },
    { label: 'Volumen', val: `${stats.totalVolumeCm3} cm³` },
  ];

  let statY = 74;
  statsList.forEach((s) => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(20, statY, 130, 15, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(s.label, 26, statY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(s.val, 26, statY + 12);

    statY += 18;
  });

  // 3D Model Snapshot Preview (Right Column)
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(165, 42, 112, 144, 4, 4, 'F');

  if (image) {
    try {
      doc.addImage(image, 'PNG', 169, 46, 104, 136, undefined, 'FAST');
    } catch (e) {
      drawPlaceholderBox(doc, 169, 46, 104, 136, 'Vista Previa 3D');
    }
  } else {
    drawPlaceholderBox(doc, 169, 46, 104, 136, 'Modelo 3D Ensamblado');
  }

  // Footer bar
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Generado con BrickCraft 3D Engine • Totalmente compatible con BambuStudio & OrcaSlicer', 20, 202);
}

function drawBomPage(doc: jsPDF, stats: ModelStatistics, w: number, h: number) {
  // Clean white / technical manual header
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(0, 0, w, h, 'F');

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, w, 16, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('CATÁLOGO DE PIEZAS & LISTA DE MATERIALES (BOM)', 14, 11);

  // Table rows from morphology counts
  const tableData: any[] = [];
  const catalogMap = new Map(BRICK_CATALOG.map((c) => [c.id, c]));

  Object.entries(stats.morphologyCounts).forEach(([morphId, count]) => {
    const morph = catalogMap.get(morphId);
    const name = morph ? morph.name : morphId;
    const dims = morph ? `${morph.width * 8} × ${morph.length * 8} × 9.6 mm` : '-';
    const studs = morph ? `${morph.width} × ${morph.length} (${morph.studCount} studs)` : '-';
    const weightEach = morph ? (morph.width * morph.length * 0.75).toFixed(1) : '1.0';
    const subtotalWeight = (parseFloat(weightEach) * count).toFixed(1);

    tableData.push([morphId, name, studs, dims, count.toString(), `${subtotalWeight} g`]);
  });

  // Render BOM Table
  autoTable(doc, {
    startY: 24,
    head: [['Código', 'Tipo de Bloque', 'Configuración', 'Dimensiones', 'Cantidad', 'Peso Estimado']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    margin: { left: 14, right: 14 },
  });

  // Summary box at bottom
  const lastY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(14, Math.min(lastY, 175), w - 28, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL GENERAL: ${stats.totalBricks} piezas`, 20, Math.min(lastY, 175) + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Peso total de filamento necesario: aprox. ${stats.estimatedWeightGrams} gramos | ${stats.layerCount} capas`, 20, Math.min(lastY, 175) + 16);
}

function drawStepPage(
  doc: jsPDF,
  step: AssemblyStep,
  stepNum: number,
  totalSteps: number,
  stepImg: string | undefined,
  w: number,
  h: number
) {
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, w, h, 'F');

  // Top Step Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, w, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`PASO ${stepNum} de ${totalSteps}: CAPA ${step.layerIndex + 1}`, 14, 12);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Progreso acumulado: ${step.totalBricksSoFar} piezas colocadas`, w - 85, 12);

  // Left Column: Parts needed in this step
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 24, 85, 172, 3, 3, 'FD');

  doc.setFillColor(59, 130, 246);
  doc.rect(14, 24, 85, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('PIEZAS PARA ESTE PASO', 18, 30);

  // Group current step bricks by morphology and color
  const partGroups = new Map<string, { morphId: string; colorHex: string; count: number; name: string }>();
  step.bricksAdded.forEach((b) => {
    const key = `${b.morphologyId}_${b.color.hex}`;
    if (!partGroups.has(key)) {
      partGroups.set(key, {
        morphId: b.morphologyId,
        colorHex: b.color.hex,
        count: 0,
        name: b.morphologyId,
      });
    }
    partGroups.get(key)!.count++;
  });

  let curY = 40;
  partGroups.forEach((group) => {
    // Color dot preview
    const rgb = hexToRgb(group.colorHex);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.circle(22, curY - 1.5, 3.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${group.count} × ${group.morphId}`, 30, curY);

    curY += 12;
  });

  // Step Tips Box at bottom of left column
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(18, 150, 77, 40, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('CONSEJO DE MONTAJE:', 22, 158);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Asegúrese de presionar cada bloque', 22, 166);
  doc.text('firmemente para garantizar la traba', 22, 172);
  doc.text('mecánica entre capas superpuestas.', 22, 178);

  // Right Column: Isometric 3D Layer Placement Diagram
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(105, 24, 178, 172, 3, 3, 'FD');

  if (stepImg) {
    try {
      doc.addImage(stepImg, 'PNG', 108, 27, 172, 166, undefined, 'FAST');
    } catch (e) {
      drawStepGridSchematic(doc, step, 105, 24, 178, 172);
    }
  } else {
    drawStepGridSchematic(doc, step, 105, 24, 178, 172);
  }
}

function drawStepGridSchematic(
  doc: jsPDF,
  step: AssemblyStep,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Esquema de Posición - Capa ${step.layerIndex + 1}`, x + 10, y + 14);

  // Draw 2D top-down grid representation of the bricks on this layer
  const gridStartX = x + 15;
  const gridStartY = y + 25;
  const cellSize = 6.0; // mm per grid unit

  step.bricksAdded.forEach((b) => {
    const bx = gridStartX + b.gridX * cellSize;
    const by = gridStartY + b.gridY * cellSize;
    const bw = b.sizeX * cellSize;
    const bh = b.sizeY * cellSize;

    const rgb = hexToRgb(b.color.hex);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setDrawColor(30, 41, 59);
    doc.rect(bx, by, bw, bh, 'FD');

    // Draw studs
    doc.setFillColor(255, 255, 255);
    for (let sx = 0; sx < b.sizeX; sx++) {
      for (let sy = 0; sy < b.sizeY; sy++) {
        doc.circle(bx + (sx + 0.5) * cellSize, by + (sy + 0.5) * cellSize, 1.2, 'S');
      }
    }
  });
}

function drawCompletionPage(
  doc: jsPDF,
  projectName: string,
  stats: ModelStatistics,
  image: string | undefined,
  w: number,
  h: number
) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, w, h, 'F');

  doc.setFillColor(34, 197, 94); // Green accent
  doc.rect(0, 0, w, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('¡MODELO COMPLETADO!', w / 2, 45, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(148, 163, 184);
  doc.text(`Has finalizado el ensamblaje de ${projectName}`, w / 2, 56, { align: 'center' });

  // Center summary badge
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(w / 2 - 80, 70, 160, 45, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246);
  doc.text(`${stats.totalBricks} Bloques Totales Enlazados`, w / 2, 86, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text(`${stats.layerCount} capas • ${stats.estimatedWeightGrams} g filamento • Estructura rígida`, w / 2, 98, { align: 'center' });

  // Model image preview
  if (image) {
    try {
      doc.addImage(image, 'PNG', w / 2 - 40, 122, 80, 65, undefined, 'FAST');
    } catch (e) {}
  }
}

function drawPlaceholderBox(doc: jsPDF, x: number, y: number, w: number, h: number, label: string) {
  doc.setDrawColor(71, 85, 105);
  doc.setLineDashPattern([2, 2], 0);
  doc.roundedRect(x, y, w, h, 2, 2, 'D');
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(label, x + w / 2, y + h / 2, { align: 'center' });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}
