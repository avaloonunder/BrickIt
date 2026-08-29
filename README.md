# BrickCraft 3D / BrickIt 🧱

> **Conversor de archivos 3D STL a Bloques Modulares Interconectables con Exportación 3MF Multicolor (BambuStudio & OrcaSlicer) y Generador de Guías de Montaje en PDF.**

[![Deploy to GitHub Pages](https://github.com/Avaloonunder/BrickIt/actions/workflows/deploy.yml/badge.svg)](https://github.com/Avaloonunder/BrickIt/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-blue.svg)](https://avaloonunder.github.io/BrickIt/)

---

## 🌟 Características Principales

1. **Voxelizado Inteligente de Mallas 3D STL**:
   - Carga cualquier archivo 3D `.stl` (binario o ASCII) o prueba con modelos de ejemplo integrados.
   - Ajusta en tiempo real la resolución de la cuadrícula, el grosor de pared (sólido o carcasa) y el tamaño modular en milímetros.

2. **Optimización de Traba y Descomposición Estructural**:
   - Algoritmo de colocación por traba mecánica (*running bond*) que alterna la orientación de los bloques entre capas pares e impares, evitando planos de debilidad estructural.
   - Catálogo modular no conflictivo con identificadores morfológicos estándar:
     - `MB-24` (Bloque 2x4)
     - `MB-23` (Bloque 2x3)
     - `MB-22` (Bloque 2x2)
     - `MB-14` (Bloque 1x4)
     - `MB-13` (Bloque 1x3)
     - `MB-12` (Bloque 1x2)
     - `MB-11` (Bloque 1x1)

3. **Geometría Modular Exclusiva y Libre de Infracciones**:
   - Espigas (*studs*) facetadas octogonales con rebaje central distintivo.
   - Cavidades y tubos de encaje inferiores con holgura calibrada para impresión 3D FDM (0.15 mm).
   - Chaflanes perimetrales para facilitar el agarre y evitar el pie de elefante.

4. **Estudio de Color & Compatibilidad con BambuStudio y OrcaSlicer**:
   - Paleta de filamentos oficiales (Bambu PLA Básico, Mate, Silk y PETG).
   - Herramientas de pintura 3D: pincel individual, bote de relleno por color, pintura por capas y gradiente de altura.
   - **Exportación 3MF Nativa**: Genera paquetes `.3mf` con extensiones de material Microsoft (`m:colorgroup`) y configuración de extrusores/AMS para BambuStudio y OrcaSlicer.
   - Dos modos de exportación:
     - **Modelo Ensamblado Multicolor**: Listo para laminar con cambio de filamento automático.
     - **Piezas Aplanadas en Cama**: Disposición plana en bandeja (256x256 mm) para imprimir sin soportes.

5. **Catálogo de Piezas & Lista de Materiales (BOM)**:
   - Resumen completo de piezas, pesos estimados en gramos y volumen en cm³.
   - Exportación de la lista de materiales a CSV y JSON.

6. **Manual Visual de Montaje Descargable en PDF**:
   - Visor interactivo en 3D capa por capa con modo fantasma y vista explosionada.
   - Generación de un PDF descargable en formato A4 apaisado con:
     - Portada con render 3D e información general del proyecto.
     - Inventario de piezas necesarias por tipo y color.
     - Diagramas paso a paso por capa con lista de piezas requeridas e indicador gráfico de posición.

---

## 🚀 Despliegue en GitHub Pages

Este proyecto está configurado con **GitHub Actions** para compilar y desplegarse automáticamente en GitHub Pages cada vez que se hace push a la rama `main`:

```bash
# URL de la aplicación:
https://avaloonunder.github.io/BrickIt/
```

---

## 🛠️ Instalación y Desarrollo Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/Avaloonunder/BrickIt.git

# 2. Entrar al directorio
cd BrickIt

# 3. Instalar dependencias
npm install

# 4. Iniciar servidor de desarrollo
npm run dev

# 5. Compilar para producción
npm run build
```

---

## 📄 Licencia

MIT License © 2026 Avaloonunder
