# Measurements & Charts - Weld Quality Analysis Tool

A web-based application for measuring dimensions, analyzing data, and visualizing weld quality metrics.

## Features

### 📏 Measurements
- **Draw measurement lines** on images - click first point, click second point
- **Calibration** - double-click any dimension to set reference measurement
- **4 work modes**: Measure, Scale, Eraser, Edit
- **Snap to angle** - snaps to 45° angles for precision
- **Magnifying loupe** - precise point positioning

### 📊 Analysis & Export
- **5 export formats** for measurements:
  - Overlay (transparent layer)
  - With measurements
  - With measurement table
  - Table as image
  - CSV (for analysis)

### 📈 CSV Analysis
- **Multi-file CSV upload**
- **Histograms and scatter plots** for each file
- **Statistics**: mean, std dev, min, max
- **Download charts** as PNG

### 🔍 Feed Rate Analysis
- **Feed rate input** (10-30 mm/min) for each sample
- **Mean vs feed rate chart** with polynomial trend
- **All measurements** vs feed rate with:
  - Anomalies (>2σ)
  - Confidence intervals (95% CI)
  - Curved trend lines
- **Detailed per-file charts** with anomalies and intervals

### ⬇️ Downloads
- Download histograms and scatter plots
- Download all speed analysis charts at once

## Usage

Open `pomiary.html` in your browser - nothing is uploaded, everything works locally.

## Technology

- HTML5 Canvas
- JavaScript ES5 (strict mode)
- Chart.js 4.4.1
- Bootstrap 5.3.3
- Python (analyze_welds.py for standalone analysis)

## Workflow

1. Load image (jpg, png, etc.)
2. Draw measurements on image
3. Export dimensions as CSV
4. Upload CSV to analysis section
5. Enter feed rates for each sample
6. Generate and download charts

## Features

- Polynomial regression for trend lines
- Statistical anomaly detection
- Confidence interval visualization
- Batch chart downloads

