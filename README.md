# Interactive 3D Cell Atlas

An interactive, accessible educational 3D web application for exploring eukaryotic cell organelles, their biological functions, and `.glb` geometry optimization—built with Three.js and styled with the Northwestern University (NU) color palette on a crisp white background.

## Features

### 1. Interactive 3D Cell & 8 Organelle Hotspots
Each numbered 3D pin is anchored directly to its corresponding organelle in the cell model:
1. **Nucleus & Nucleolus** — DNA storage & replication, mRNA transcription, and ribosomal subunit biogenesis.
2. **Mitochondria** — Aerobic cellular respiration, ATP synthesis, and calcium homeostasis.
3. **Endoplasmic Reticulum (Rough & Smooth ER)** — Secretory/membrane protein folding, lipid & steroid synthesis, and detoxification.
4. **Golgi Apparatus** — Post-translational modification, vesicle sorting & trafficking, and lysosome formation.
5. **Plasma Cell Membrane** — Selective permeability, receptor signal transduction, and endocytosis/exocytosis.
6. **Lysosomes & Peroxisomes** — Autophagy & recycling, phagocytosis defense, and H₂O₂ detoxification.
7. **Ribosomes (80S Complexes)** — mRNA decoding and peptide bond catalysis.
8. **Cytoplasm & Cytoskeleton** — Mechanical support, microtubule motor protein highways, and cytosolic glycolysis.

Clicking any pin (or pressing keys `1`–`8`) smoothly flies the camera to that region and opens an educational card detailing its cellular functions. You can also place custom 3D surface hotspots by clicking **+ Add Hotspot** and clicking anywhere on the 3D mesh.

### 2. Guided Cell Tour
Click **▶ Guided Tour** in the top bar to automatically fly from organelle #1 through #8 on a timed sequence, or use **◀ Prev Organelle** / **Next Organelle ▶** (or `←` / `→` arrow keys) to step through at your own pace.

### 3. Interactive "Quiz Me" Study Mode
Click **Quiz Me** to test your knowledge of cellular functions:
- Pin labels hide automatically so you identify structures by shape and location.
- Click the matching 3D hotspot pin on the cell (or in the sidebar) to answer.
- Receive instant feedback, fly the camera to the organelle, and track your score out of 8.

### 4. Accessibility & UX Controls
- **Keyboard Shortcuts (`?`):** `1`–`8` jump to organelles, `←`/`→` step through organelles or tabs, `Space` pauses/resumes animation, `R` resets camera, `H` toggles hotspots.
- **Reduce Motion:** Respects `prefers-reduced-motion` and includes a manual **Reduce Motion** toggle.
- **Larger Text (`A+`):** Scales UI and educational card text for easier reading.
- **Search & Filter:** Filter organelles in real time by name or biological function (e.g., `ATP`, `DNA`, `protein`).

### 5. Live `.glb` Size & Material Inspector
- Compare the original **60.05 MB** Tripo export (`cells-original.glb`) with **17.74 MB** (`cells-hd.glb`), **7.76 MB** (`cells.glb`), and **2.61 MB** (`cells-lite.glb`) presets, or drag-and-drop any `.glb`/`.gltf` file.
- Adjust biological stains, PBR roughness/metalness, normal map relief, X-Ray membrane opacity, and wireframe view.

## Project Files

- `index.html` — Main interactive 3D Cell Atlas web application.
- `cells-interactive-standalone.html` — Self-contained single-file HTML with inline Base64 `.glb` fallback for `file://` usage.
- `cells-original.glb` — Original 60.05 MB Tripo 3D cell model (1,219,782 vertices / 1,976,499 triangles).
- `cells-hd.glb` — Studio HD optimized model (17.74 MB).
- `cells.glb` — Balanced High-Res optimized model (7.76 MB).
- `cells-lite.glb` — Ultra-Lite Web optimized model (2.61 MB, 16-bit indices).
- `start-server.bat` / `start-server.ps1` — Zero-dependency local PowerShell HTTP server (`http://localhost:8080`).

## Running Locally

- **Option A (No Server):** Open `cells-interactive-standalone.html` directly in any modern browser.
- **Option B (Local HTTP Server):** Run `start-server.bat` (Windows) or `powershell -ExecutionPolicy Bypass -File start-server.ps1` and visit `http://localhost:8080`.
