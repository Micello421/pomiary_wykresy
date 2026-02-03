/* -*- JavaScript -*- */
"use strict";

// Chart analysis module
(function() {
  var chartSection = document.getElementById('chart-analysis-section');
  var toggleBtn = document.getElementById('chart-toggle-btn');
  var closeBtn = document.getElementById('chart-close-btn');
  var csvChooser = document.getElementById('csv-file-chooser');
  var generateBtn = document.getElementById('generate-charts-btn');
  var generateSpeedBtn = document.getElementById('generate-speed-chart-btn');
  var chartsOutput = document.getElementById('charts-output');
  var speedInputsContainer = document.getElementById('speed-inputs');
  var speedSummaryCanvas = document.getElementById('speed-summary-chart');
  var downloadSpeedBtn = document.getElementById('download-speed-chart-btn');
  var generateDetailedBtn = document.getElementById('generate-detailed-speed-charts-btn');
  var detailedSpeedSection = document.getElementById('detailed-speed-section');
  var generateAggregateBtn = document.getElementById('generate-aggregate-speed-charts-btn');
  var aggregateChartsContainer = document.getElementById('aggregate-charts-container');
  
  var generateGeometryBtn = document.getElementById('generate-geometry-model-btn');
  var geometryModelContainer = document.getElementById('geometry-model-container');
  
  var chartInstances = [];
  var summaryChartInstance = null;
  var aggregateChartInstances = [];
  var geometryChartInstances = [];
  var fileMeans = {};
  var speedInputsMap = {};
  var fileData = {};
  var detailedChartInstances = [];
  
  // Toggle chart section
  toggleBtn.addEventListener('click', function() {
    chartSection.classList.toggle('open');
  });
  
  closeBtn.addEventListener('click', function() {
    chartSection.classList.remove('open');
  });

  csvChooser.addEventListener('change', function() {
    buildSpeedInputs(csvChooser.files);
    clearSpeedSummaryChart();
  });
  
  // Generate charts when button clicked
  generateBtn.addEventListener('click', function() {
    var files = csvChooser.files;
    if (files.length === 0) {
      alert('Please select at least one CSV file');
      return;
    }
    
    // Clear previous charts
    destroyAllCharts();
    fileMeans = {};
    fileData = {};
    chartsOutput.innerHTML = '<p class="text-center text-info">Generating charts...</p>';
    
    // Process each file
    var processedCount = 0;
    for (var i = 0; i < files.length; i++) {
      processCSVFile(files[i], function() {
        processedCount++;
        if (processedCount === files.length) {
          // All files processed
          if (chartInstances.length === 0) {
            chartsOutput.innerHTML = '<p class="text-center text-warning">No data found in CSV files</p>';
          }
        }
      });
    }
  });

  generateSpeedBtn.addEventListener('click', function() {
    var hasMeans = Object.keys(fileMeans).length > 0;
    if (!hasMeans) {
      alert('Generate charts first to calculate averages.');
      return;
    }
    createSpeedSummaryChart();
  });

  downloadSpeedBtn.addEventListener('click', function() {
    if (!summaryChartInstance) {
      alert('Generate mean vs speed chart first.');
      return;
    }
    downloadChartAsJPG(speedSummaryCanvas, 'mean-vs-speed.jpg');
  });

  var downloadHistogramsBtn = document.getElementById('download-histograms-btn');
  downloadHistogramsBtn.addEventListener('click', function() {
    downloadHistogramsAndScatter();
  });

  var downloadSpeedChartsBtn = document.getElementById('download-speed-charts-btn');
  downloadSpeedChartsBtn.addEventListener('click', function() {
    downloadSpeedCharts();
  });

  generateDetailedBtn.addEventListener('click', function() {
    if (Object.keys(fileData).length === 0) {
      alert('Generate charts first to get measurement data.');
      return;
    }
    createDetailedSpeedCharts();
  });

  generateAggregateBtn.addEventListener('click', function() {
    if (Object.keys(fileData).length === 0) {
      alert('Generate charts first to get measurement data.');
      return;
    }
    createAggregateSpeedCharts();
  });
  
  function destroyAllCharts() {
    for (var i = 0; i < chartInstances.length; i++) {
      chartInstances[i].destroy();
    }
    chartInstances = [];
    for (var i = 0; i < detailedChartInstances.length; i++) {
      detailedChartInstances[i].destroy();
    }
    detailedChartInstances = [];
    clearSpeedSummaryChart();
  }

  function clearSpeedSummaryChart() {
    if (summaryChartInstance) {
      summaryChartInstance.destroy();
      summaryChartInstance = null;
    }
  }

  function buildSpeedInputs(files) {
    speedInputsContainer.innerHTML = '';
    speedInputsMap = {};
    var defaultSpeeds = [10, 15, 20, 25, 30];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var row = document.createElement('div');
      row.className = 'speed-input-row';

      var label = document.createElement('label');
      label.textContent = file.name;
      row.appendChild(label);

      var input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.min = '0';
      input.placeholder = 'posuw (mm/min)';
      if (i < defaultSpeeds.length) {
        input.value = defaultSpeeds[i];
      }
      input.className = 'form-control form-control-sm';
      row.appendChild(input);

      speedInputsContainer.appendChild(row);
      speedInputsMap[file.name] = input;
    }
  }
  
  function processCSVFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var content = e.target.result;
      var measurements = parseCSV(content);
      
      if (measurements.length > 0) {
        if (chartInstances.length === 0) {
          chartsOutput.innerHTML = '';
        }
        generateChartsForFile(file.name, measurements);
      }
      
      callback();
    };
    reader.readAsText(file);
  }
  
  function parseCSV(content) {
    var measurements = [];
    var lines = content.split('\n');
    
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      
      // Pattern: "Pomiar X: Y mm" (but not "Pomiar do skali")
      var match = line.match(/^Pomiar (\d+): ([\d.]+) mm/);
      if (match) {
        var index = parseInt(match[1]);
        var value = parseFloat(match[2]);
        measurements.push({ index: index, value: value });
        continue;
      }
      
      // Old format: "Pomiar,X,Y,..."
      if (line.startsWith('Pomiar,')) {
        var parts = line.split(',');
        if (parts.length >= 3) {
          try {
            var idx = parseInt(parts[1]);
            var val = parseFloat(parts[2]);
            if (!isNaN(idx) && !isNaN(val)) {
              measurements.push({ index: idx, value: val });
            }
          } catch (e) {
            // Skip invalid lines
          }
        }
      }
    }
    
    return measurements;
  }
  
  function generateChartsForFile(filename, measurements) {
    var values = measurements.map(function(m) { return m.value; });
    var indices = measurements.map(function(m) { return m.index; });
    
    var mean = calculateMean(values);
    fileMeans[filename] = mean;
    fileData[filename] = { values: values, indices: indices, mean: mean };
    var std = calculateStdDev(values, mean);
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    
    // Create container for this file
    var container = document.createElement('div');
    container.className = 'mb-5';
    
    var titleWrapper = document.createElement('div');
    titleWrapper.className = 'file-section-title';
    
    var title = document.createElement('h4');
    title.textContent = filename;
    title.className = 'text-warning mb-0';
    titleWrapper.appendChild(title);
    
    var downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'btn btn-success btn-sm';
    downloadAllBtn.textContent = '⬇ Pobierz wszystkie wykresy';
    downloadAllBtn.onclick = function() {
      downloadChartAsJPG(histCanvas, filename + '_histogram.jpg');
      setTimeout(function() {
        downloadChartAsJPG(scatterCanvas, filename + '_scatter.jpg');
      }, 100);
    };
    titleWrapper.appendChild(downloadAllBtn);
    
    container.appendChild(titleWrapper);

    var summaryBlock = document.createElement('div');
    summaryBlock.className = 'summary-block';
    var summaryTitle = document.createElement('div');
    summaryTitle.className = 'summary-title text-light';
    summaryTitle.textContent = 'Measurements Summary (p0..p' + (values.length - 1) + ')';
    summaryBlock.appendChild(summaryTitle);

    var summaryGrid = document.createElement('div');
    summaryGrid.className = 'measurements-summary';
    for (var s = 0; s < values.length; s++) {
      var summaryItem = document.createElement('div');
      summaryItem.className = 'summary-item';
      summaryItem.textContent = 'p' + s + ' - ' + values[s].toFixed(3) + ' mm';
      summaryGrid.appendChild(summaryItem);
    }
    summaryBlock.appendChild(summaryGrid);
    container.appendChild(summaryBlock);
    
    // Histogram
    var histContainer = document.createElement('div');
    histContainer.className = 'chart-container';
    var histTitle = document.createElement('h6');
    histTitle.textContent = 'Weld Width Distribution';
    histTitle.className = 'text-light mb-3';
    histContainer.appendChild(histTitle);
    var histDownloadBtn = document.createElement('button');
    histDownloadBtn.className = 'btn btn-info btn-sm chart-download-btn';
    histDownloadBtn.textContent = '⬇ Pobierz histogram (JPG)';
    histDownloadBtn.onclick = function() {
      downloadChartAsJPG(histCanvas, filename + '_histogram.jpg');
    };
    histContainer.appendChild(histDownloadBtn);
    
    
    var histWrapper = document.createElement('div');
    histWrapper.className = 'chart-canvas-wrapper';
    var histCanvas = document.createElement('canvas');
    histWrapper.appendChild(histCanvas);
    histContainer.appendChild(histWrapper);
    
    var statsBox = document.createElement('div');
    statsBox.className = 'stats-box';
    statsBox.innerHTML = '<strong>Statistics:</strong> n = ' + values.length + 
                        ' | mean = ' + mean.toFixed(3) + ' mm' +
                        ' | std = ' + std.toFixed(3) + ' mm' +
                        ' | min = ' + min.toFixed(3) + ' mm' +
                        ' | max = ' + max.toFixed(3) + ' mm';
    histContainer.appendChild(statsBox);
    
    container.appendChild(histContainer);
    
    // Scatter plot
    var scatterContainer = document.createElement('div');
    scatterContainer.className = 'chart-container';
    var scatterTitle = document.createElement('h6');
    scatterTitle.textContent = 'Dimensions vs Measurement Number';
    scatterTitle.className = 'text-light mb-3';
    scatterContainer.appendChild(scatterTitle);
    
    var scatterWrapper = document.createElement('div');
    scatterWrapper.className = 'chart-canvas-wrapper';
    var scatterCanvas = document.createElement('canvas');
    scatterWrapper.appendChild(scatterCanvas);
    scatterContainer.appendChild(scatterWrapper);
    
    var trendLine = calculateTrendLine(indices, values);
    var scatterDownloadBtn = document.createElement('button');
    scatterDownloadBtn.className = 'btn btn-info btn-sm chart-download-btn';
    scatterDownloadBtn.textContent = '⬇ Pobierz wykres rozproszenia (JPG)';
    scatterDownloadBtn.onclick = function() {
      downloadChartAsJPG(scatterCanvas, filename + '_scatter.jpg');
    };
    scatterContainer.appendChild(scatterDownloadBtn);
    
    var scatterStats = document.createElement('div');
    scatterStats.className = 'stats-box';
    scatterStats.innerHTML = '<strong>Trend:</strong> y = ' + trendLine.slope.toFixed(4) + 'x + ' + 
                            trendLine.intercept.toFixed(3) + 
                            ' | <strong>Mean:</strong> ' + mean.toFixed(3) + ' mm' +
                            ' | <strong>Zakres:</strong> ' + min.toFixed(3) + ' - ' + max.toFixed(3) + ' mm';
    scatterContainer.appendChild(scatterStats);
    
    container.appendChild(scatterContainer);
    
    chartsOutput.appendChild(container);
    
    // Create histogram chart
    var histChart = createHistogram(histCanvas, values, mean, filename);
    chartInstances.push(histChart);
    
    // Create scatter chart
    var scatterChart = createScatterPlot(scatterCanvas, indices, values, mean, trendLine, filename);
    chartInstances.push(scatterChart);
  }
  
  function createHistogram(canvas, values, mean, filename) {
    var bins = 15;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var binWidth = (max - min) / bins;
    
    var histogram = new Array(bins).fill(0);
    var binLabels = [];
    
    for (var i = 0; i < bins; i++) {
      var binStart = min + i * binWidth;
      var binEnd = binStart + binWidth;
      binLabels.push(binStart.toFixed(2) + '-' + binEnd.toFixed(2));
      
      for (var j = 0; j < values.length; j++) {
        if (values[j] >= binStart && (i === bins - 1 ? values[j] <= binEnd : values[j] < binEnd)) {
          histogram[i]++;
        }
      }
    }
    
    var ctx = canvas.getContext('2d');
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: 'Measurement Count',
          data: histogram,
          backgroundColor: 'rgba(70, 130, 180, 0.7)',
          borderColor: 'rgba(70, 130, 180, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'Rozkład wymiarów - ' + filename,
            color: '#fff',
            font: { size: 14 }
          },
          legend: {
            labels: { color: '#fff' }
          },
          annotation: {
            annotations: [{
              type: 'line',
              mode: 'vertical',
              scaleID: 'x',
              value: mean,
              borderColor: 'red',
              borderWidth: 2,
              label: {
                content: 'Mean',
                enabled: true
              }
            }]
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Wymiar spoiny [mm]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Liczba pomiarów',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
  }
  
  function createScatterPlot(canvas, indices, values, mean, trendLine, filename) {
    var scatterData = [];
    var trendData = [];
    
    for (var i = 0; i < indices.length; i++) {
      scatterData.push({ x: indices[i], y: values[i] });
      trendData.push({ 
        x: indices[i], 
        y: trendLine.slope * indices[i] + trendLine.intercept 
      });
    }
    
    var ctx = canvas.getContext('2d');
    return new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Pomiary',
            data: scatterData,
            backgroundColor: 'rgba(70, 130, 180, 0.6)',
            borderColor: 'rgba(0, 0, 0, 0.5)',
            borderWidth: 1,
            pointRadius: 6
          },
          {
            label: 'Trend',
            data: trendData,
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0
          },
          {
            label: 'Średnia',
            data: scatterData.map(function(d) { return { x: d.x, y: mean }; }),
            type: 'line',
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [3, 3],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'Dimensions vs Measurement Number - ' + filename,
            color: '#fff',
            font: { size: 14 }
          },
          legend: {
            labels: { color: '#fff' }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Numer pomiaru',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Wymiar spoiny [mm]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
  }
  
  function calculateMean(values) {
    var sum = 0;
    for (var i = 0; i < values.length; i++) {
      sum += values[i];
    }
    return sum / values.length;
  }
  
  function calculateStdDev(values, mean) {
    var sumSquares = 0;
    for (var i = 0; i < values.length; i++) {
      var diff = values[i] - mean;
      sumSquares += diff * diff;
    }
    return Math.sqrt(sumSquares / values.length);
  }

  function createSpeedSummaryChart() {
    clearSpeedSummaryChart();

    var points = [];
    for (var filename in fileMeans) {
      if (!fileMeans.hasOwnProperty(filename)) continue;
      var input = speedInputsMap[filename];
      if (!input) continue;
      var speed = parseFloat(input.value);
      if (!isNaN(speed) && speed > 0) {
        points.push({ x: speed, y: fileMeans[filename], filename: filename });
      }
    }

    if (points.length === 0) {
      alert('Enter feed rate for at least one sample.');
      return;
    }

    points.sort(function(a, b) { return a.x - b.x; });
    var lineData = points.map(function(p) { return { x: p.x, y: p.y }; });

    var ctx = speedSummaryCanvas.getContext('2d');
    summaryChartInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Mean Weld Width',
            data: points,
            backgroundColor: 'rgba(255, 193, 7, 0.7)',
            borderColor: 'rgba(255, 193, 7, 1)',
            borderWidth: 1,
            pointRadius: 6
          },
          {
            label: 'Trend',
            data: lineData,
            type: 'line',
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'Mean Weld Width vs Feed Rate',
            color: '#fff',
            font: { size: 14 }
          },
          legend: {
            labels: { color: '#fff' }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                var raw = context.raw || {};
                var name = raw.filename ? (' (' + raw.filename + ')') : '';
                return 'v=' + context.parsed.x + ' mm/min, mean=' + context.parsed.y.toFixed(3) + ' mm' + name;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Prędkość posuwu [mm/min]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Mean Weld Width [mm]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
  }
  
  
  function downloadChartAsJPG(canvas, filename, options) {
    var opts = options || {};
    var background = opts.background || '#f2f2f2';
    var quality = typeof opts.quality === 'number' ? opts.quality : 0.95;
    var exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    var exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = background;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    var link = document.createElement('a');
    link.download = filename;
    link.href = exportCanvas.toDataURL('image/jpeg', quality);
    link.click();
  }

  function downloadHistogramsAndScatter() {
    var chartsToDownload = [];
    var delay = 300;
    
    // Individual histograms and scatter plots
    for (var i = 0; i < chartInstances.length; i++) {
      var canvas = chartInstances[i].canvas;
      var fileIndex = Math.floor(i / 2) + 1;
      var isHistogram = (i % 2 === 0);
      var filename = 'plik' + fileIndex + (isHistogram ? '_histogram' : '_scatter') + '.jpg';
      chartsToDownload.push({ canvas: canvas, name: filename });
    }
    
    if (chartsToDownload.length === 0) {
      alert('No charts to download. Generate charts first.');
      return;
    }
    
    // Download all with delay
    for (var i = 0; i < chartsToDownload.length; i++) {
      (function(item, index) {
        setTimeout(function() {
          downloadChartAsJPG(item.canvas, item.name);
        }, index * delay);
      })(chartsToDownload[i], i);
    }
    
    alert('Downloading ' + chartsToDownload.length + ' histogram and scatter charts...');
  }

  function downloadSpeedCharts() {
    var chartsToDownload = [];
    var delay = 300;
    
    // 1. Speed summary chart
    if (summaryChartInstance) {
      chartsToDownload.push({ canvas: speedSummaryCanvas, name: '01_srednia-vs-posuw.jpg' });
    }
    
    // 2. Aggregate charts
    for (var i = 0; i < aggregateChartInstances.length; i++) {
      var canvas = aggregateChartInstances[i].canvas;
      if (i === 0) {
        chartsToDownload.push({ canvas: canvas, name: '02_wszystkie_pomiary_anomalies.jpg' });
      } else if (i === 1) {
        chartsToDownload.push({ canvas: canvas, name: '03_wszystkie_pomiary_intervals.jpg' });
      }
    }
    
    // 3. Detailed speed charts (per-file anomalies and intervals)
    for (var i = 0; i < detailedChartInstances.length; i++) {
      var canvas = detailedChartInstances[i].canvas;
      var fileIndex = Math.floor(i / 2) + 1;
      var isAnomalies = (i % 2 === 0);
      var filename = '04_plik' + fileIndex + (isAnomalies ? '_anomalies' : '_intervals') + '.jpg';
      chartsToDownload.push({ canvas: canvas, name: filename });
    }
    
    if (chartsToDownload.length === 0) {
      alert('No speed charts to download. Generate speed charts first.');
      return;
    }
    
    // Download all with delay
    for (var i = 0; i < chartsToDownload.length; i++) {
      (function(item, index) {
        setTimeout(function() {
          downloadChartAsJPG(item.canvas, item.name);
        }, index * delay);
      })(chartsToDownload[i], i);
    }
    
    alert('Downloading ' + chartsToDownload.length + ' speed charts...');
  }

  function detectAnomalies(values, mean, stdDev) {
    var anomalies = [];
    var threshold = 2 * stdDev;
    for (var i = 0; i < values.length; i++) {
      if (Math.abs(values[i] - mean) > threshold) {
        anomalies.push(i);
      }
    }
    return anomalies;
  }

  function createDetailedSpeedCharts() {
    detailedSpeedSection.innerHTML = '';
    for (var i = 0; i < detailedChartInstances.length; i++) {
      detailedChartInstances[i].destroy();
    }
    detailedChartInstances = [];

    var fileList = Object.keys(fileData).sort();
    var colors = [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(75, 192, 75, 0.6)',
      'rgba(255, 193, 7, 0.6)',
      'rgba(153, 102, 255, 0.6)'
    ];

    for (var f = 0; f < fileList.length; f++) {
      var filename = fileList[f];
      var data = fileData[filename];
      var values = data.values;
      var mean = data.mean;
      var stdDev = calculateStdDev(values, mean);
      var anomalies = detectAnomalies(values, mean, stdDev);
      var speedValue = speedInputsMap[filename] ? parseFloat(speedInputsMap[filename].value) : 0;

      // Create container
      var container = document.createElement('div');
      container.className = 'speed-chart-pair';

      // Chart 1: Values with anomalies
      var chart1Div = document.createElement('div');
      chart1Div.className = 'chart-container';
      var title1 = document.createElement('h6');
      title1.className = 'text-light mb-2';
      title1.textContent = filename + ' (' + speedValue + ' mm/min) - All Measurements + Anomalies';
      chart1Div.appendChild(title1);

      var canvas1 = document.createElement('canvas');
      chart1Div.appendChild(canvas1);

      var downloadBtn1 = document.createElement('button');
      downloadBtn1.className = 'btn btn-info btn-sm chart-download-btn';
      downloadBtn1.textContent = '⬇ Pobierz';
      (function(c) {
        downloadBtn1.onclick = function() {
          downloadChartAsJPG(c, filename.replace('.csv', '') + '_anomalies.jpg');
        };
      })(canvas1);
      chart1Div.appendChild(downloadBtn1);

      container.appendChild(chart1Div);

      // Chart 2: Values with confidence intervals
      var chart2Div = document.createElement('div');
      chart2Div.className = 'chart-container';
      var title2 = document.createElement('h6');
      title2.className = 'text-light mb-2';
      title2.textContent = filename + ' (' + speedValue + ' mm/min) - With Error Intervals';
      chart2Div.appendChild(title2);

      var canvas2 = document.createElement('canvas');
      chart2Div.appendChild(canvas2);

      var downloadBtn2 = document.createElement('button');
      downloadBtn2.className = 'btn btn-info btn-sm chart-download-btn';
      downloadBtn2.textContent = '⬇ Pobierz';
      (function(c) {
        downloadBtn2.onclick = function() {
          downloadChartAsJPG(c, filename.replace('.csv', '') + '_intervals.jpg');
        };
      })(canvas2);
      chart2Div.appendChild(downloadBtn2);

      container.appendChild(chart2Div);
      detailedSpeedSection.appendChild(container);

      // Create chart 1: Anomalies
      createAnomalyChart(canvas1, values, mean, stdDev, anomalies, filename, colors[f % colors.length]);

      // Create chart 2: Confidence intervals
      createConfidenceChart(canvas2, values, mean, stdDev, filename, colors[f % colors.length]);
    }
  }

  function createAnomalyChart(canvas, values, mean, stdDev, anomalies, filename, color) {
    var normalPoints = [];
    var anomalyPoints = [];

    for (var i = 0; i < values.length; i++) {
      var point = { x: i + 1, y: values[i] };
      if (anomalies.indexOf(i) >= 0) {
        anomalyPoints.push(point);
      } else {
        normalPoints.push(point);
      }
    }

    var meanLine = values.map(function(v, i) { return { x: i + 1, y: mean }; });

    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Normal Measurements',
            data: normalPoints,
            backgroundColor: color,
            borderColor: color.replace('0.6', '1'),
            borderWidth: 1,
            pointRadius: 5
          },
          {
            label: 'Anomalies',
            data: anomalyPoints,
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            borderColor: 'rgba(255, 0, 0, 1)',
            borderWidth: 2,
            pointRadius: 7,
            pointStyle: 'star'
          },
          {
            label: 'Mean',
            data: meanLine,
            type: 'line',
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        plugins: {
          title: {
            display: true,
            text: 'Measurements with Anomaly Indication',
            color: '#fff',
            font: { size: 12 }
          },
          legend: {
            labels: { color: '#fff', font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Pomiar ' + context.parsed.x + ': ' + context.parsed.y.toFixed(3) + ' mm';
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Numer pomiaru',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Szerokość [mm]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
    detailedChartInstances.push(chart);
  }

  function createConfidenceChart(canvas, values, mean, stdDev, filename, color) {
    var n = values.length;
    var ci95 = 1.96 * stdDev;
    var upperBound = mean + ci95;
    var lowerBound = Math.max(0, mean - ci95);

    var dataPoints = values.map(function(v, i) { return { x: i + 1, y: v }; });
    var meanLine = values.map(function(v, i) { return { x: i + 1, y: mean }; });
    var upperLine = values.map(function(v, i) { return { x: i + 1, y: upperBound }; });
    var lowerLine = values.map(function(v, i) { return { x: i + 1, y: lowerBound }; });

    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Pomiary',
            data: dataPoints,
            backgroundColor: color,
            borderColor: color.replace('0.6', '1'),
            borderWidth: 1,
            pointRadius: 5
          },
          {
            label: 'Średnia',
            data: meanLine,
            type: 'line',
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: 'Górny limit (95%)',
            data: upperLine,
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            borderDash: [3, 3]
          },
          {
            label: 'Dolny limit (95%)',
            data: lowerLine,
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            borderDash: [3, 3]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        plugins: {
          title: {
            display: true,
            text: 'Measurements with Confidence Intervals (95%)',
            color: '#fff',
            font: { size: 12 }
          },
          legend: {
            labels: { color: '#fff', font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(3) + ' mm';
              }
            }
          },
          filler: {
            propagate: true
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Numer pomiaru',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Szerokość [mm]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
    detailedChartInstances.push(chart);
  }
  function calculateTrendLine(x, y) {
    var n = x.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (var i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
    }
    
    var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    var intercept = (sumY - slope * sumX) / n;
    
    return { slope: slope, intercept: intercept };
  }

  function calculatePolynomialTrendLine(x, y) {
    // Polynomial regression of degree 2 (ax^2 + bx + c)
    var n = x.length;
    var sumX = 0, sumY = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumXY = 0, sumX2Y = 0;
    
    for (var i = 0; i < n; i++) {
      var xi = x[i];
      var yi = y[i];
      var x2 = xi * xi;
      sumX += xi;
      sumY += yi;
      sumX2 += x2;
      sumX3 += x2 * xi;
      sumX4 += x2 * x2;
      sumXY += xi * yi;
      sumX2Y += x2 * yi;
    }
    
    // Solve using normal equations for polynomial regression
    var A = [
      [n, sumX, sumX2],
      [sumX, sumX2, sumX3],
      [sumX2, sumX3, sumX4]
    ];
    
    var b = [sumY, sumXY, sumX2Y];
    
    // Gaussian elimination
    for (var i = 0; i < 3; i++) {
      var max = i;
      for (var k = i + 1; k < 3; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[max][i])) {
          max = k;
        }
      }
      
      var temp = A[i];
      A[i] = A[max];
      A[max] = temp;
      var tempB = b[i];
      b[i] = b[max];
      b[max] = tempB;
      
      for (var k = i + 1; k < 3; k++) {
        var factor = A[k][i] / A[i][i];
        for (var j = i; j < 3; j++) {
          A[k][j] -= factor * A[i][j];
        }
        b[k] -= factor * b[i];
      }
    }
    
    var coeffs = new Array(3);
    for (var i = 2; i >= 0; i--) {
      coeffs[i] = b[i];
      for (var j = i + 1; j < 3; j++) {
        coeffs[i] -= A[i][j] * coeffs[j];
      }
      coeffs[i] /= A[i][i];
    }
    
    return { c: coeffs[0], b: coeffs[1], a: coeffs[2] };
  }

  function evaluatePolynomial(x, coeffs) {
    return coeffs.a * x * x + coeffs.b * x + coeffs.c;
  }

  function getSpeedRange(points) {
    var min = Infinity;
    var max = -Infinity;
    for (var i = 0; i < points.length; i++) {
      var x = points[i].x;
      if (x < min) { min = x; }
      if (x > max) { max = x; }
    }
    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 0;
    }
    return { min: min, max: max };
  }

  function buildTrendAndForecastLines(points, coeffs, step) {
    var range = getSpeedRange(points);
    var minX = range.min;
    var maxX = range.max;
    var span = Math.max(1, (maxX - minX));
    var extra = Math.max(2, span * 0.25);
    var forecastMin = minX - extra;
    var forecastMax = maxX + extra;
    var observed = [];
    for (var x = minX; x <= maxX; x += step) {
      observed.push({ x: x, y: evaluatePolynomial(x, coeffs) });
    }

    var forecastLeft = [];
    // Left side (before observed range)
    for (var xl = forecastMin; xl <= (minX - step); xl += step) {
      forecastLeft.push({ x: xl, y: evaluatePolynomial(xl, coeffs) });
    }
    var forecastRight = [];
    // Right side (after observed range)
    for (var xr = (maxX + step); xr <= forecastMax; xr += step) {
      forecastRight.push({ x: xr, y: evaluatePolynomial(xr, coeffs) });
    }

    return {
      observed: observed,
      forecastLeft: forecastLeft,
      forecastRight: forecastRight,
      minX: minX,
      maxX: maxX,
      forecastMin: forecastMin,
      forecastMax: forecastMax
    };
  }

  function createAggregateSpeedCharts() {
    aggregateChartsContainer.innerHTML = '';
    for (var i = 0; i < aggregateChartInstances.length; i++) {
      aggregateChartInstances[i].destroy();
    }
    aggregateChartInstances = [];

    // Collect all measurements with their speeds
    var allPoints = [];
    var fileList = Object.keys(fileData).sort();
    
    for (var f = 0; f < fileList.length; f++) {
      var filename = fileList[f];
      var speedValue = speedInputsMap[filename] ? parseFloat(speedInputsMap[filename].value) : 0;
      var values = fileData[filename].values;
      
      for (var v = 0; v < values.length; v++) {
        allPoints.push({ x: speedValue, y: values[v], filename: filename });
      }
    }

    if (allPoints.length === 0) {
      alert('Brak danych do wyświetlenia.');
      return;
    }

    // Calculate overall statistics
    var allValues = allPoints.map(function(p) { return p.y; });
    var overallMean = calculateMean(allValues);
    var overallStdDev = calculateStdDev(allValues, overallMean);
    var anomalies = detectAnomalies(allValues, overallMean, overallStdDev);

    // Create container with two charts side by side
    var container = document.createElement('div');
    container.className = 'speed-chart-pair';

    // Chart 1: Anomalies
    var chart1Div = document.createElement('div');
    chart1Div.className = 'chart-container';
    var title1 = document.createElement('h6');
    title1.className = 'text-light mb-2';
    title1.textContent = 'All Measurements vs Feed Rate - with Anomalies';
    chart1Div.appendChild(title1);

    var canvas1 = document.createElement('canvas');
    chart1Div.appendChild(canvas1);

    var downloadBtn1 = document.createElement('button');
    downloadBtn1.className = 'btn btn-info btn-sm chart-download-btn';
    downloadBtn1.textContent = '⬇ Pobierz';
    (function(c) {
      downloadBtn1.onclick = function() {
        downloadChartAsJPG(c, 'wszystkie_pomiary_anomalies.jpg');
      };
    })(canvas1);
    chart1Div.appendChild(downloadBtn1);

    container.appendChild(chart1Div);

    // Chart 2: Confidence intervals
    var chart2Div = document.createElement('div');
    chart2Div.className = 'chart-container';
    var title2 = document.createElement('h6');
    title2.className = 'text-light mb-2';
    title2.textContent = 'All Measurements vs Feed Rate - with Confidence Intervals';
    chart2Div.appendChild(title2);

    var canvas2 = document.createElement('canvas');
    chart2Div.appendChild(canvas2);

    var downloadBtn2 = document.createElement('button');
    downloadBtn2.className = 'btn btn-info btn-sm chart-download-btn';
    downloadBtn2.textContent = '⬇ Pobierz';
    (function(c) {
      downloadBtn2.onclick = function() {
        downloadChartAsJPG(c, 'wszystkie_pomiary_intervals.jpg');
      };
    })(canvas2);
    chart2Div.appendChild(downloadBtn2);

    container.appendChild(chart2Div);
    aggregateChartsContainer.appendChild(container);

    // Create charts
    createAggregateAnomalyChart(canvas1, allPoints, overallMean, overallStdDev, anomalies);
    createAggregateConfidenceChart(canvas2, allPoints, overallMean, overallStdDev);
  }

  function createAggregateAnomalyChart(canvas, points, mean, stdDev, anomalies) {
    var normalPoints = [];
    var anomalyPoints = [];

    for (var i = 0; i < points.length; i++) {
      if (anomalies.indexOf(i) >= 0) {
        anomalyPoints.push(points[i]);
      } else {
        normalPoints.push(points[i]);
      }
    }

    // Calculate polynomial trend line
    var xs = points.map(function(p) { return p.x; });
    var ys = points.map(function(p) { return p.y; });
    var polyCoeffs = calculatePolynomialTrendLine(xs, ys);

    // Generate smooth curve with many points + forecast
    var trendData = buildTrendAndForecastLines(points, polyCoeffs, 0.5);

    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Normal Measurements',
            data: normalPoints,
            backgroundColor: 'rgba(70, 130, 180, 0.5)',
            borderColor: 'rgba(70, 130, 180, 1)',
            borderWidth: 0.5,
            pointRadius: 4
          },
          {
            label: 'Anomalies',
            data: anomalyPoints,
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            borderColor: 'rgba(255, 0, 0, 1)',
            borderWidth: 1.5,
            pointRadius: 6,
            pointStyle: 'star'
          },
          {
            label: 'Trend',
            data: trendData.observed,
            type: 'line',
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.4
          },
          {
            label: 'Prognoza (trend) - lewa',
            data: trendData.forecastLeft,
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.95)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [6, 4],
            tension: 0.4
          },
          {
            label: 'Prognoza (trend) - prawa',
            data: trendData.forecastRight,
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.95)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [6, 4],
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'All Measurements with Anomaly Indication (>2σ)',
            color: '#fff',
            font: { size: 12 }
          },
          legend: {
            labels: { color: '#fff', font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(3) + ' mm (v=' + context.parsed.x + ' mm/min)';
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Prędkość posuwu [mm/min]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Szerokość spoiny [mm]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
    aggregateChartInstances.push(chart);
  }

  function createAggregateConfidenceChart(canvas, points, mean, stdDev) {
    var ci95 = 1.96 * stdDev;
    var upperBound = mean + ci95;
    var lowerBound = Math.max(0, mean - ci95);

    // Calculate polynomial trend line
    var xs = points.map(function(p) { return p.x; });
    var ys = points.map(function(p) { return p.y; });
    var polyCoeffs = calculatePolynomialTrendLine(xs, ys);

    // Generate smooth curve with many points + forecast
    var trendData = buildTrendAndForecastLines(points, polyCoeffs, 0.5);
    
    var upperLines = [];
    var lowerLines = [];
    for (var s = trendData.forecastMin; s <= trendData.forecastMax; s += 0.5) {
      upperLines.push({ x: s, y: upperBound });
      lowerLines.push({ x: s, y: lowerBound });
    }

    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Pomiary',
            data: points,
            backgroundColor: 'rgba(70, 130, 180, 0.5)',
            borderColor: 'rgba(70, 130, 180, 1)',
            borderWidth: 0.5,
            pointRadius: 4
          },
          {
            label: 'Trend',
            data: trendData.observed,
            type: 'line',
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.4
          },
          {
            label: 'Prognoza (trend) - lewa',
            data: trendData.forecastLeft,
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.95)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [6, 4],
            tension: 0.4
          },
          {
            label: 'Prognoza (trend) - prawa',
            data: trendData.forecastRight,
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.95)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [6, 4],
            tension: 0.4
          },
          {
            label: 'Górny limit (95%)',
            data: upperLines,
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            borderDash: [3, 3]
          },
          {
            label: 'Dolny limit (95%)',
            data: lowerLines,
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            borderDash: [3, 3]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'All Measurements with Confidence Intervals (95%)',
            color: '#fff',
            font: { size: 12 }
          },
          legend: {
            labels: { color: '#fff', font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(3) + ' mm';
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Prędkość posuwu [mm/min]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Szerokość spoiny [mm]',
              color: '#fff'
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
    aggregateChartInstances.push(chart);
  }

  // Geometry model section
  generateGeometryBtn.addEventListener('click', function() {
    if (Object.keys(fileData).length === 0) {
      alert('Najpierw wygeneruj wykresy, aby uzyskać dane pomiarowe.');
      return;
    }
    createGeometryModel();
  });

  function createGeometryModel() {
    geometryModelContainer.innerHTML = '';
    for (var i = 0; i < geometryChartInstances.length; i++) {
      geometryChartInstances[i].destroy();
    }
    geometryChartInstances = [];

    // Collect ALL measurements from all files
    var allMeasurements = [];
    var geometryData = [];
    var fileList = Object.keys(fileData).sort();
    
    for (var f = 0; f < fileList.length; f++) {
      var filename = fileList[f];
      var speedValue = speedInputsMap[filename] ? parseFloat(speedInputsMap[filename].value) : 0;
      
      var values = fileData[filename].values;
      var mean = calculateMean(values);
      var stdDev = calculateStdDev(values, mean);
      var relativeError = (stdDev / mean) * 100;
      
      // Add to per-file data
      geometryData.push({
        speed: speedValue,
        mean: mean,
        stdDev: stdDev,
        relativeError: relativeError,
        filename: filename,
        n: values.length
      });

      // Add all measurements to global collection
      for (var v = 0; v < values.length; v++) {
        allMeasurements.push({
          value: values[v],
          speed: speedValue,
          filename: filename
        });
      }
    }

    if (allMeasurements.length === 0) {
      geometryModelContainer.innerHTML = '<p class="text-warning">Brak danych do wyświetlenia. Najpierw wygeneruj wykresy.</p>';
      return;
    }

    geometryData.sort(function(a, b) { return a.speed - b.speed; });

    // Calculate overall statistics
    var allValues = allMeasurements.map(function(m) { return m.value; });
    var overallMean = calculateMean(allValues);
    var overallStdDev = calculateStdDev(allValues, overallMean);
    var overallRelativeError = (overallStdDev / overallMean) * 100;
    var minValue = Math.min.apply(null, allValues);
    var maxValue = Math.max.apply(null, allValues);

    // Create main container
    var mainContainer = document.createElement('div');
    mainContainer.className = 'mb-4';

    // Overall statistics summary
    var summaryBox = document.createElement('div');
    summaryBox.className = 'stats-box mb-4';
    summaryBox.innerHTML = '<strong>Statystyki globalne:</strong> ' +
                          'n = ' + allMeasurements.length + 
                          ' | μ = ' + overallMean.toFixed(3) + ' mm' +
                          ' | σ = ' + overallStdDev.toFixed(3) + ' mm' +
                          ' | Błąd wzgl. = ' + overallRelativeError.toFixed(2) + '%' +
                          ' | min = ' + minValue.toFixed(3) + ' mm' +
                          ' | max = ' + maxValue.toFixed(3) + ' mm';
    mainContainer.appendChild(summaryBox);

    // Weld geometry visualization (cross-sections)
    var visualTitle = document.createElement('h6');
    visualTitle.className = 'text-light mb-3';
    visualTitle.textContent = 'Wizualizacja przekrojów napoiny dla różnych prędkości';
    mainContainer.appendChild(visualTitle);

    var visualCanvas = document.createElement('canvas');
    visualCanvas.id = 'geometry-visual-canvas';
    mainContainer.appendChild(visualCanvas);

    var downloadVisualBtn = document.createElement('button');
    downloadVisualBtn.className = 'btn btn-info btn-sm chart-download-btn mt-2 mb-4';
    downloadVisualBtn.textContent = '⬇ Pobierz wizualizację (JPG)';
    downloadVisualBtn.onclick = function() {
      downloadChartAsJPG(visualCanvas, 'wizualizacja-geometrii-napoiny.jpg');
    };
    mainContainer.appendChild(downloadVisualBtn);

    // Chart 1: All measurements scatter with mean and error bands
    var scatterTitle = document.createElement('h6');
    scatterTitle.className = 'text-light mb-3 mt-4';
    scatterTitle.textContent = 'Wszystkie pomiary z analizą błędu (średnia globalna ± σ)';
    mainContainer.appendChild(scatterTitle);

    var scatterCanvas = document.createElement('canvas');
    mainContainer.appendChild(scatterCanvas);

    var downloadScatterBtn = document.createElement('button');
    downloadScatterBtn.className = 'btn btn-info btn-sm chart-download-btn mt-2 mb-4';
    downloadScatterBtn.textContent = '⬇ Pobierz wykres rozproszenia (JPG)';
    downloadScatterBtn.onclick = function() {
      downloadChartAsJPG(scatterCanvas, 'wszystkie-pomiary-geometria.jpg');
    };
    mainContainer.appendChild(downloadScatterBtn);

    // Chart 2: Mean width vs Speed with error bars
    var chartTitle = document.createElement('h6');
    chartTitle.className = 'text-light mb-3 mt-4';
    chartTitle.textContent = 'Średnia szerokość napoiny per prędkość ± odchylenie standardowe';
    mainContainer.appendChild(chartTitle);

    var chartCanvas = document.createElement('canvas');
    mainContainer.appendChild(chartCanvas);

    var downloadChartBtn = document.createElement('button');
    downloadChartBtn.className = 'btn btn-info btn-sm chart-download-btn mt-2';
    downloadChartBtn.textContent = '⬇ Pobierz wykres (JPG)';
    downloadChartBtn.onclick = function() {
      downloadChartAsJPG(chartCanvas, 'model-geometrii-napoiny.jpg');
    };
    mainContainer.appendChild(downloadChartBtn);

    // Detailed error analysis description
    var analysisDesc = document.createElement('div');
    analysisDesc.className = 'stats-box mt-4 mb-3';
    analysisDesc.innerHTML = '<strong>Wyjaśnienie analizy błędu:</strong><br>' +
      '<small style="color: #ddd; line-height: 1.6;">' +
      '<strong>• Dane obserwowane:</strong> Linia zielona to średnia globalna (μ) ze wszystkich pomiarów. Pasmo żółte (±σ) pokazuje zakres jednego odchylenia standardowego - obszar, w którym leży ~68% danych.<br>' +
      '<strong>• Odchylenie standardowe (σ):</strong> σ = ' + overallStdDev.toFixed(3) + ' mm - miara zmienności pomiarów wokół średniej.<br>' +
      '<strong>• Błąd względny:</strong> (' + overallRelativeError.toFixed(2) + '%) = (σ/μ)×100% - pokazuje błąd jako procent średniej.<br>' +
      '<strong>• Prognoza (linie przerywane):</strong> Linie purpurowe to przedłużenie średniej poza zakres pomiarów.<br>' +
      '<strong>• Pasmo prognozy (różowe):</strong> Niepewność rośnie wraz z oddaleniem od danych obserwowanych. Im dalej od danych, tym większa niepewność (linia robi się szersza).' +
      '</small></div>';
    mainContainer.appendChild(analysisDesc);

    // Stats table
    var statsTitle = document.createElement('h6');
    statsTitle.className = 'text-light mt-4 mb-2';
    statsTitle.textContent = 'Tabela analizy błędów pomiarowych (statystyki per plik)';
    mainContainer.appendChild(statsTitle);

    var table = document.createElement('table');
    table.className = 'table table-dark table-striped table-sm';
    table.style.cssText = 'font-size: 10pt;';
    
    var thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Plik</th><th>v [mm/min]</th><th>n</th><th>μ [mm]</th><th>σ [mm]</th><th>Błąd wzgl. [%]</th></tr>';
    table.appendChild(thead);
    
    var tbody = document.createElement('tbody');
    for (var i = 0; i < geometryData.length; i++) {
      var d = geometryData[i];
      var row = document.createElement('tr');
      row.innerHTML = '<td>' + d.filename + '</td>' +
                      '<td>' + (d.speed > 0 ? d.speed.toFixed(1) : 'N/A') + '</td>' +
                      '<td>' + d.n + '</td>' +
                      '<td>' + d.mean.toFixed(3) + '</td>' +
                      '<td>' + d.stdDev.toFixed(3) + '</td>' +
                      '<td>' + d.relativeError.toFixed(2) + '</td>';
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    mainContainer.appendChild(table);

    geometryModelContainer.appendChild(mainContainer);

    // Create weld cross-section visualization
    createWeldVisualization(visualCanvas, geometryData);

    // Create scatter plot with all measurements
    createAllMeasurementsScatter(scatterCanvas, allMeasurements, overallMean, overallStdDev);

    // Create chart with error bars per speed
    createGeometryChart(chartCanvas, geometryData);
  }

  function createAllMeasurementsScatter(canvas, allMeasurements, overallMean, overallStdDev) {
    var scatterData = allMeasurements.map(function(m) {
      return { x: m.speed, y: m.value };
    });

    var speeds = [];
    for (var i = 0; i < allMeasurements.length; i++) {
      var s = allMeasurements[i].speed;
      if (speeds.indexOf(s) === -1 && s > 0) {
        speeds.push(s);
      }
    }
    speeds.sort(function(a, b) { return a - b; });

    var meanLine = [];
    var upperBand = [];
    var lowerBand = [];
    var forecastLeft = [];
    var forecastRightMean = [];
    var forecastRightUpper = [];
    var forecastRightLower = [];
    
    if (speeds.length > 0) {
      var minSpeed = Math.min.apply(null, speeds);
      var maxSpeed = Math.max.apply(null, speeds);
      var span = maxSpeed - minSpeed;
      var extra = Math.max(5, span * 0.5);
      var step = span > 0 ? span / 30 : 1;
      if (step === 0) step = 1;
      
      // Calculate polynomial trend for the mean band (not just constant)
      // Extract speeds and values for polynomial calculation
      var xVals = [];
      var yVals = [];
      for (var i = 0; i < allMeasurements.length; i++) {
        xVals.push(allMeasurements[i].speed);
        yVals.push(allMeasurements[i].value);
      }
      var trendCoeffs = calculatePolynomialTrendLine(xVals, yVals);
      
      // Fallback to constant mean if polynomial calculation fails
      if (!trendCoeffs || trendCoeffs.length === 0) {
        trendCoeffs = [overallMean, 0, 0]; // Constant line
      }
      
      // Observed range with polynomial trend
      for (var s = minSpeed; s <= maxSpeed; s += step) {
        var trendValue = evaluatePolynomial(trendCoeffs, s);
        meanLine.push({ x: s, y: trendValue });
        upperBand.push({ x: s, y: trendValue + overallStdDev });
        lowerBand.push({ x: s, y: Math.max(0, trendValue - overallStdDev) });
      }
      
      // Left forecast
      for (var sl = minSpeed - extra; sl < (minSpeed - step); sl += step) {
        var forecastVal = evaluatePolynomial(trendCoeffs, sl);
        forecastLeft.push({ x: sl, y: forecastVal });
      }
      
      // Right forecast (with increasing uncertainty)
      for (var sr = maxSpeed + step; sr <= maxSpeed + extra; sr += step) {
        var distFromData = sr - maxSpeed;
        var uncertainty = overallStdDev * (1 + distFromData / span);
        var forecastVal = evaluatePolynomial(trendCoeffs, sr);
        forecastRightMean.push({ x: sr, y: forecastVal });
        forecastRightUpper.push({ x: sr, y: forecastVal + uncertainty });
        forecastRightLower.push({ x: sr, y: Math.max(0, forecastVal - uncertainty) });
      }
    }

    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Wszystkie pomiary',
            data: scatterData,
            backgroundColor: 'rgba(70, 130, 180, 0.5)',
            borderColor: 'rgba(70, 130, 180, 1)',
            borderWidth: 0.5,
            pointRadius: 4
          },
          {
            label: 'Średnia globalna (μ) - dane obserwowane',
            data: meanLine,
            type: 'line',
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 0
          },
          {
            label: 'Pasmo +σ (dane obserwowane)',
            data: upperBand,
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0
          },
          {
            label: 'Pasmo -σ (dane obserwowane)',
            data: lowerBand,
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0
          },
          {
            label: 'Prognoza (lewa)',
            data: forecastLeft,
            type: 'line',
            borderColor: 'rgba(156, 39, 176, 0.9)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [8, 4],
            pointRadius: 0
          },
          {
            label: 'Prognoza (prawa)',
            data: forecastRightMean,
            type: 'line',
            borderColor: 'rgba(156, 39, 176, 0.9)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [8, 4],
            pointRadius: 0
          },
          {
            label: 'Pasmo prognozy +σ (z rosnącą niepewnością)',
            data: forecastRightUpper,
            type: 'line',
            borderColor: 'rgba(233, 30, 99, 0.6)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: 0
          },
          {
            label: 'Pasmo prognozy -σ (z rosnącą niepewnością)',
            data: forecastRightLower,
            type: 'line',
            borderColor: 'rgba(233, 30, 99, 0.6)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.2,
        plugins: {
          title: {
            display: true,
            text: 'Wszystkie pomiary z prognozą i analizą błędu',
            color: '#fff',
            font: { size: 14, weight: 'bold' }
          },
          legend: {
            labels: { color: '#fff', font: { size: 10 } },
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(3) + ' mm';
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Prędkość posuwu [mm/min] | Dane obserwowane | Prognoza',
              color: '#fff',
              font: { size: 12, weight: 'bold' }
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Szerokość napoiny [mm]',
              color: '#fff',
              font: { size: 12, weight: 'bold' }
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
    geometryChartInstances.push(chart);
  }

  function createWeldVisualization(canvas, geometryData) {
    var ctx = canvas.getContext('2d');
    canvas.width = 1200;
    canvas.height = 400;

    // Background
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var margin = { top: 50, right: 40, bottom: 80, left: 60 };
    var plotWidth = canvas.width - margin.left - margin.right;
    var plotHeight = canvas.height - margin.top - margin.bottom;

    var n = geometryData.length;
    var sectionWidth = plotWidth / n;

    // Scale for weld width (vertical)
    var maxWidth = 0;
    for (var i = 0; i < geometryData.length; i++) {
      var upper = geometryData[i].mean + geometryData[i].stdDev;
      if (upper > maxWidth) maxWidth = upper;
    }
    var widthScale = plotHeight / (maxWidth * 1.3);

    // Draw title
    ctx.fillStyle = '#111';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Przekroje napoiny w funkcji prędkości posuwu', canvas.width / 2, 25);

    // Draw each weld cross-section
    for (var i = 0; i < geometryData.length; i++) {
      var d = geometryData[i];
      var x = margin.left + i * sectionWidth + sectionWidth / 2;
      var mean = d.mean;
      var stdDev = d.stdDev;

      // Draw weld profile (simplified parabolic shape)
      var weldWidth = mean * widthScale;
      var weldHeight = weldWidth * 0.4;
      var baseY = margin.top + plotHeight;

      // Main weld body (mean)
      ctx.fillStyle = 'rgba(70, 130, 180, 0.7)';
      ctx.beginPath();
      ctx.ellipse(x, baseY - weldHeight / 2, weldWidth / 2, weldHeight / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Error range visualization (stdDev)
      var upperWidth = (mean + stdDev) * widthScale;
      var lowerWidth = Math.max(0, mean - stdDev) * widthScale;
      
      ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      
      // Upper bound
      ctx.beginPath();
      ctx.ellipse(x, baseY - weldHeight / 2, upperWidth / 2, (upperWidth * 0.4) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      // Lower bound
      ctx.beginPath();
      ctx.ellipse(x, baseY - weldHeight / 2, lowerWidth / 2, (lowerWidth * 0.4) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.setLineDash([]);

      // Labels
      ctx.fillStyle = '#111';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(d.speed.toFixed(0) + ' mm/min', x, baseY + 20);
      ctx.fillText('μ=' + mean.toFixed(2) + 'mm', x, baseY + 35);
      ctx.fillText('σ=' + stdDev.toFixed(2) + 'mm', x, baseY + 50);
    }

    // Legend
    ctx.fillStyle = '#111';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('█ Średnia szerokość', margin.left, canvas.height - 15);
    
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(margin.left + 200, canvas.height - 20);
    ctx.lineTo(margin.left + 250, canvas.height - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('Zakres ±σ', margin.left + 260, canvas.height - 15);
  }

  function createGeometryChart(canvas, geometryData) {
    var speeds = geometryData.map(function(d) { return d.speed; });
    var means = geometryData.map(function(d) { return d.mean; });
    var stdDevs = geometryData.map(function(d) { return d.stdDev; });

    var upperBounds = [];
    var lowerBounds = [];
    for (var i = 0; i < geometryData.length; i++) {
      upperBounds.push({ x: speeds[i], y: means[i] + stdDevs[i] });
      lowerBounds.push({ x: speeds[i], y: Math.max(0, means[i] - stdDevs[i]) });
    }

    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: speeds,
        datasets: [
          {
            label: 'Średnia szerokość (μ)',
            data: means,
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            borderWidth: 3,
            pointRadius: 6,
            pointBackgroundColor: 'rgba(76, 175, 80, 1)',
            fill: false
          },
          {
            label: 'Górna granica (μ + σ)',
            data: upperBounds,
            borderColor: 'rgba(255, 193, 7, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
            fill: false
          },
          {
            label: 'Dolna granica (μ - σ)',
            data: lowerBounds,
            borderColor: 'rgba(255, 193, 7, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'Geometria napoiny w funkcji prędkości posuwu (z analizą błędu)',
            color: '#fff',
            font: { size: 14 }
          },
          legend: {
            labels: { color: '#fff', font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(3) + ' mm';
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Prędkość posuwu [mm/min]',
              color: '#fff',
              font: { size: 12 }
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: {
              display: true,
              text: 'Szerokość napoiny [mm]',
              color: '#fff',
              font: { size: 12 }
            },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
    geometryChartInstances.push(chart);
  }
})();
