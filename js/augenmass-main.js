/* -*- JavaScript -*- */
/*
 * potential TODO
 * - clean up. This is mostly experimental code right now figuring out how
 *   JavaScript works and stuff :) Put things with their own state in objects.
 * - Endpoints should have the T, but angle-centers just a little circle.
 *   (so: points that have > 1 lines attached to a point)
 * - circle radius estimation (separate mode)
 *    o three dots circle, 4 ellipsis,  but allow multiple dots
 *      and minimize error.
 *    o axis where the center would be plus two dots.
 * - modes: draw single line, polyline, mark circle, select (for delete)
 * - select: left click selects a line (endpoints and center). Highlight;
 *   del deletes.
 * - shift + mouse movement: only allow for discrete 360/16 angles.
 * - alt + mouse movement: snap to point in the vicinity.
 * - provide a 'reference straight line' defining the 0 degree angle.
 * - 'collision detection' for labels. Labels should in general be drawn
 *   separately and optimized for non-collision with other labels, lines and
 *   arcs. Make them align with lines, unless too steep angle (+/- 60 degrees?).
 * - checkbox 'show angles', 'show labels'
 * - export as SVG that includes the original image.
 *   background, labels, support-lines (arcs and t-lines) and lines
 *   should be in separate layers to individually look at them.
 *   (exporting just an image with the lines on top crashes browsers; play
 *   with toObjectUrl for download).
 */
"use strict";

// Some constants.

// How lines usually look like (blue with yellow background should make
// it sufficiently distinct in many images).
var line_style = "#00f";
var background_line_style = "rgba(255, 255, 0, 0.4)";
var background_line_width = 7;

// Scale measurement style (distinct color).
var scale_line_style = "#00c853";
var background_scale_line_style = "rgba(0, 200, 83, 0.35)";

// On highlight.
var highlight_line_style = "#f00";
var background_highlight_line_style = "rgba(0, 255, 255, 0.4)";

var length_font_pixels = 12;
var angle_font_pixels = 10;
var loupe_magnification = 7;
var end_bracket_len = 5;

// These variables need to be cut down and partially be private
// to the modules.
var help_system;
var aug_view;
var backgroundImage; // if loaded. Also used by the loupe.
var tool_mode = "measure"; // measure | scale | erase | edit
var snap_to_angle_enabled = false;
var edited_line = undefined; // line being edited in edit mode
var edited_point = undefined; // 1 or 2 for p1 or p2

// Init function. Call once on page-load.
function augenmass_init() {
  help_system = new HelpSystem(document.getElementById("helptext"));
  aug_view = new AugenmassView(document.getElementById("measure"));

  var show_delta_checkbox = document.getElementById("show-deltas");
  show_delta_checkbox.addEventListener("change", function (e) {
    aug_view.setShowDeltas(show_delta_checkbox.checked);
    aug_view.drawAll();
  });

  var show_angle_checkbox = document.getElementById("show-angles");
  show_angle_checkbox.addEventListener("change", function (e) {
    aug_view.setShowAngles(show_angle_checkbox.checked);
    aug_view.drawAll();
  });

  var mode_measure = document.getElementById("mode-measure");
  var mode_scale = document.getElementById("mode-scale");
  var mode_erase = document.getElementById("mode-erase");
  var mode_edit = document.getElementById("mode-edit");
  mode_measure.addEventListener("click", function () {
    set_tool_mode("measure");
  });
  mode_scale.addEventListener("click", function () {
    set_tool_mode("scale");
  });
  mode_erase.addEventListener("click", function () {
    set_tool_mode("erase");
  });
  mode_edit.addEventListener("click", function () {
    set_tool_mode("edit");
  });
  set_tool_mode("measure");

  var snap_checkbox = document.getElementById("snap-to-angle");
  snap_checkbox.addEventListener("change", function () {
    snap_to_angle_enabled = snap_checkbox.checked;
  });

  loupe_canvas = document.getElementById("loupe");
  loupe_canvas.style.left = document.body.clientWidth - loupe_canvas.width - 10;
  loupe_ctx = loupe_canvas.getContext("2d");
  // We want to see the pixels:
  loupe_ctx.imageSmoothingEnabled = false;
  loupe_ctx.mozImageSmoothingEnabled = false;
  loupe_ctx.webkitImageSmoothingEnabled = false;

  aug_view.resetWithSize(10, 10); // Some default until we have an image.

  var chooser = document.getElementById("file-chooser");
  chooser.addEventListener("change", function (e) {
    load_background_image(chooser);
  });

  var download_link = document.getElementById("download-result");
  download_link.addEventListener(
    "click",
    function () {
      download_result(download_link);
    },
    false
  );
  download_link.style.opacity = 0; // not visible at first.
  download_link.style.cursor = "default";

  var download_combined_link = document.getElementById("download-combined");
  download_combined_link.addEventListener(
    "click",
    function () {
      download_result_with_image(download_combined_link);
    },
    false
  );
  download_combined_link.style.opacity = 0; // not visible at first.
  download_combined_link.style.cursor = "default";

  var download_combined_table_link = document.getElementById(
    "download-combined-table"
  );
  download_combined_table_link.addEventListener(
    "click",
    function () {
      download_result_with_image_and_table(download_combined_table_link);
    },
    false
  );
  download_combined_table_link.style.opacity = 0; // not visible at first.
  download_combined_table_link.style.cursor = "default";

  var download_table_image_link = document.getElementById(
    "download-table-image"
  );
  download_table_image_link.addEventListener(
    "click",
    function () {
      download_table_image(download_table_image_link);
    },
    false
  );
  download_table_image_link.style.opacity = 0; // not visible at first.
  download_table_image_link.style.cursor = "default";

  var download_table_csv_link = document.getElementById("download-table-csv");
  download_table_csv_link.addEventListener(
    "click",
    function () {
      download_table_csv(download_table_csv_link);
    },
    false
  );
  download_table_csv_link.style.opacity = 0; // not visible at first.
  download_table_csv_link.style.cursor = "default";

  var measurements_toggle = document.getElementById("measurements-toggle");
  var measurements_panel = document.getElementById("measurements-panel");
  measurements_toggle.addEventListener("click", function () {
    measurements_panel.classList.toggle("collapsed");
  });

  init_toolbar_zoom_compensation();
}

function init_toolbar_zoom_compensation() {
  var toolbar = document.getElementById("toolbar");
  if (!toolbar) return;

  function updateToolbarScale() {
    var scale = 1;
    if (window.visualViewport && window.visualViewport.scale) {
      scale = window.visualViewport.scale;
    }
    var inv = 1 / scale;
    toolbar.style.transform = "scale(" + inv + ")";
    toolbar.style.width = (100 * scale).toFixed(3) + "vw";
  }

  updateToolbarScale();
  window.addEventListener("resize", updateToolbarScale);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateToolbarScale);
    window.visualViewport.addEventListener("scroll", updateToolbarScale);
  }
}

function set_tool_mode(mode) {
  tool_mode = mode;
  var mode_measure = document.getElementById("mode-measure");
  var mode_scale = document.getElementById("mode-scale");
  var mode_erase = document.getElementById("mode-erase");
  var mode_edit = document.getElementById("mode-edit");
  mode_measure.classList.toggle("active", mode === "measure");
  mode_scale.classList.toggle("active", mode === "scale");
  mode_erase.classList.toggle("active", mode === "erase");
  mode_edit.classList.toggle("active", mode === "edit");
  mode_measure.classList.toggle("btn-primary", mode === "measure");
  mode_measure.classList.toggle("btn-outline-light", mode !== "measure");
  mode_scale.classList.toggle("btn-primary", mode === "scale");
  mode_scale.classList.toggle("btn-outline-light", mode !== "scale");
  mode_erase.classList.toggle("btn-primary", mode === "erase");
  mode_erase.classList.toggle("btn-outline-light", mode !== "erase");
  mode_edit.classList.toggle("btn-primary", mode === "edit");
  mode_edit.classList.toggle("btn-outline-light", mode !== "edit");

  var measure_canvas = document.getElementById("measure");
  if (mode === "erase") {
    measure_canvas.style.cursor = "not-allowed";
  } else if (mode === "scale") {
    measure_canvas.style.cursor = "crosshair";
  } else if (mode === "edit") {
    measure_canvas.style.cursor = "grab";
  } else {
    measure_canvas.style.cursor =
      "url(icons/target-cursor.png) 31 31,crosshair";
  }

  if (aug_view && mode !== "measure" && mode !== "scale" && mode !== "edit") {
    var model = aug_view.getModel();
    if (model && model.hasEditLine()) {
      model.forgetEditLine();
      aug_view.drawAll();
    }
  }
}

function AugenmassController(canvas, view) {
  // This doesn't have any public methods.
  this.start_line_time_ = 0;

  var self = this;
  canvas.addEventListener("mousedown", function (e) {
    extract_event_pos(e, function (e, x, y) {
      self.onClick(e, x, y);
    });
  });
  canvas.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  canvas.addEventListener("mousemove", function (e) {
    extract_event_pos(e, onMove);
  });
  canvas.addEventListener("dblclick", function (e) {
    extract_event_pos(e, onDoubleClick);
  });
  document.addEventListener("keydown", onKeyEvent);

  function extract_event_pos(e, callback) {
    // browser and scroll-independent extraction of mouse cursor in canvas.
    var x, y;
    if (e.pageX != undefined && e.pageY != undefined) {
      x = e.pageX;
      y = e.pageY;
    } else {
      x = e.clientX + scrollLeft();
      y = e.clientY + scrollY();
    }
    x -= canvas.offsetLeft;
    y -= canvas.offsetTop;

    callback(e, x, y);
  }

  function getModel() {
    return view.getModel();
  }
  function getView() {
    return view;
  }

  function cancelCurrentLine() {
    if (getModel().hasEditLine()) {
      getModel().forgetEditLine();
      getView().drawAll();
    }
  }

  function onKeyEvent(e) {
    if (e.keyCode == 27) {
      // ESC key.
      cancelCurrentLine();
    }
  }

  function apply_scale_from_line(line) {
    getView().highlightLine(line);
    var orig_len_txt = (
      getView().getUnitsPerPixel() * line.length()
    ).toPrecision(4);
    var new_value_txt = prompt("Length of selected line (mm)?", orig_len_txt);
    if (orig_len_txt != new_value_txt) {
      var new_value = parseFloat(new_value_txt);
      if (new_value && new_value > 0) {
        getView().setUnitsPerPixel(new_value / line.length());
      }
    }
    help_system.achievementUnlocked(HelpLevelEnum.DONE_SET_LEN);
    getView().drawAll();
  }

  function apply_snap_to_angle(p1, target) {
    if (!snap_to_angle_enabled) return { x: target.x, y: target.y };
    var dx = target.x - p1.x;
    var dy = target.y - p1.y;
    var angle = Math.atan2(dy, dx);
    var angle_deg = (angle * 180) / Math.PI;
    var snap_angles = [0, 45, 90, 135, 180, -135, -90, -45];
    var closest_snap = snap_angles[0];
    var min_diff = 360;
    for (var i = 0; i < snap_angles.length; ++i) {
      var diff = Math.abs(snap_angles[i] - angle_deg);
      if (diff > 180) diff = 360 - diff;
      if (diff < min_diff) {
        min_diff = diff;
        closest_snap = snap_angles[i];
      }
    }
    if (min_diff < 8) {
      var snap_angle = (closest_snap * Math.PI) / 180;
      var len = euklid_distance(p1.x, p1.y, target.x, target.y);
      return {
        x: p1.x + len * Math.cos(snap_angle),
        y: p1.y + len * Math.sin(snap_angle),
      };
    }
    return { x: target.x, y: target.y };
  }

  function onMove(e, x, y) {
    if (backgroundImage === undefined) return;
    var has_editline = getModel().hasEditLine();
    if (has_editline) {
      var snapped = apply_snap_to_angle(getModel().getEditLine().p1, {
        x: x + 0.5,
        y: y + 0.5,
      });
      getModel().updateEditLine(snapped.x - 0.5, snapped.y - 0.5);
    }
    if (edited_line !== undefined && edited_point !== undefined) {
      if (edited_point === 1) {
        var snapped_p1 = apply_snap_to_angle(edited_line.p2, {
          x: x + 0.5,
          y: y + 0.5,
        });
        edited_line.p1.update(snapped_p1.x, snapped_p1.y);
      } else {
        var snapped_edit = apply_snap_to_angle(edited_line.p1, {
          x: x + 0.5,
          y: y + 0.5,
        });
        edited_line.p2.update(snapped_edit.x, snapped_edit.y);
      }
    }
    showFadingLoupe(x, y);
    if (!has_editline && edited_line === undefined) return;
    getView().drawAll();
  }

  this.onClick = function (e, x, y) {
    if (e.which != undefined && e.which == 3) {
      // right mouse button.
      if (getModel().hasEditLine()){
        cancelCurrentLine();
      } else{
        // delete line when not editing
        var selected_line = getModel().findClosest(x, y);
        if (selected_line === undefined) return;
        getModel().removeLine(selected_line);
        getView().drawAll();
      }
      return;
    }

    if (tool_mode === "erase") {
      cancelCurrentLine();
      var selected_line = getModel().findClosest(x, y);
      if (selected_line === undefined) return;
      getModel().removeLine(selected_line);
      getView().drawAll();
      return;
    }

    if (tool_mode === "edit") {
      cancelCurrentLine();
      var selected_line = getModel().findClosest(x, y);
      if (selected_line === undefined) return;
      edited_line = selected_line;
      var dist_p1 = euklid_distance(x, y, selected_line.p1.x, selected_line.p1.y);
      var dist_p2 = euklid_distance(x, y, selected_line.p2.x, selected_line.p2.y);
      edited_point = dist_p1 < dist_p2 ? 1 : 2;
      return;
    }

    var now = new Date().getTime();
    if (!getModel().hasEditLine()) {
      getModel().startEditLine(x, y, tool_mode === "scale");
      this.start_line_time_ = now;
      help_system.achievementUnlocked(HelpLevelEnum.DONE_START_LINE);
    } else {
      var line = getModel().updateEditLine(x, y);
      // Make sure that this was not a double-click event.
      // (are there better ways ?)
      if (
        line.length() > 50 ||
        (line.length() > 0 && now - this.start_line_time_ > 500)
      ) {
        getModel().commitEditLine();
        help_system.achievementUnlocked(HelpLevelEnum.DONE_FINISH_LINE);
      } else {
        getModel().forgetEditLine();
      }
    }
    edited_line = undefined;
    edited_point = undefined;
    getView().drawAll();
  };

  function onDoubleClick(e, x, y) {
    cancelCurrentLine();
    edited_line = undefined;
    edited_point = undefined;
    var selected_line = getModel().findClosest(x, y);
    if (selected_line == undefined) return;
    apply_scale_from_line(selected_line);
  }
}

function scrollTop() {
  return document.body.scrollTop + document.documentElement.scrollTop;
}

function scrollLeft() {
  return document.body.scrollLeft + document.documentElement.scrollLeft;
}

function init_download(filename) {
  var pos = filename.lastIndexOf(".");
  if (pos > 0) {
    filename = filename.substr(0, pos);
  }
  var download_link = document.getElementById("download-result");
  download_link.download = "augenmass-" + filename + ".png";
  download_link.style.cursor = "pointer";
  download_link.style.opacity = 1;

  var download_combined_link = document.getElementById("download-combined");
  download_combined_link.download =
    "augenmass-" + filename + "-with-measurements.png";
  download_combined_link.style.cursor = "pointer";
  download_combined_link.style.opacity = 1;

  var download_combined_table_link = document.getElementById(
    "download-combined-table"
  );
  download_combined_table_link.download =
    "augenmass-" + filename + "-with-measurements-table.png";
  download_combined_table_link.style.cursor = "pointer";
  download_combined_table_link.style.opacity = 1;

  var download_table_image_link = document.getElementById(
    "download-table-image"
  );
  download_table_image_link.download =
    "augenmass-" + filename + "-measurements-table.png";
  download_table_image_link.style.cursor = "pointer";
  download_table_image_link.style.opacity = 1;

  var download_table_csv_link = document.getElementById("download-table-csv");
  download_table_csv_link.download =
    "augenmass-" + filename + "-measurements.csv";
  download_table_csv_link.style.cursor = "pointer";
  download_table_csv_link.style.opacity = 1;
}

function download_result(download_link) {
  if (backgroundImage === undefined) return;
  aug_view.drawAll();
  download_link.href = aug_view.getCanvas().toDataURL("image/png");
}

function download_result_with_image(download_link) {
  if (backgroundImage === undefined) return;
  // Ensure the overlay is up to date.
  aug_view.drawAll();

  var combined_canvas = document.createElement("canvas");
  combined_canvas.width = backgroundImage.width;
  combined_canvas.height = backgroundImage.height;
  var combined_ctx = combined_canvas.getContext("2d");

  combined_ctx.drawImage(backgroundImage, 0, 0);
  aug_view.drawAllNoClear(combined_ctx);

  download_link.href = combined_canvas.toDataURL("image/png");
}

function download_result_with_image_and_table(download_link) {
  if (backgroundImage === undefined) return;
  aug_view.drawAll();

  var table_data = collect_measurements_data();
  var table_layout = layout_measurements_table(table_data);

  var combined_canvas = document.createElement("canvas");
  combined_canvas.width = backgroundImage.width + table_layout.width;
  combined_canvas.height = Math.max(backgroundImage.height, table_layout.height);
  var combined_ctx = combined_canvas.getContext("2d");

  combined_ctx.drawImage(backgroundImage, 0, 0);
  aug_view.drawAllNoClear(combined_ctx);
  draw_measurements_table(combined_ctx, backgroundImage.width, 0, table_layout);

  download_link.href = combined_canvas.toDataURL("image/png");
}

function download_table_image(download_link) {
  if (backgroundImage === undefined) return;
  var table_data = collect_measurements_data();
  var table_layout = layout_measurements_table(table_data);

  var table_canvas = document.createElement("canvas");
  table_canvas.width = table_layout.width;
  table_canvas.height = table_layout.height;
  var table_ctx = table_canvas.getContext("2d");

  draw_measurements_table(table_ctx, 0, 0, table_layout);
  download_link.href = table_canvas.toDataURL("image/png");
}

function download_table_csv(download_link) {
  if (backgroundImage === undefined) return;
  var data = collect_measurements_data();
  var units_per_pixel = aug_view.getUnitsPerPixel();

  var rows = [];
  rows.push(["Scale: 1 px = " + units_per_pixel.toPrecision(4) + " mm"]);
  rows.push([]);

  for (var i = 0; i < data.length; ++i) {
    var entry = data[i];
    var label = entry.is_scale ? "Pomiar do skali" : "Pomiar";
    var text = label + " " + entry.index + ": " + entry.length;
    if (entry.show_deltas) {
      text += " (dx=" + entry.dx + ", dy=" + entry.dy + ")";
    }
    rows.push([text]);
  }

  var csv = rows
    .map(function (row) {
      return row
        .map(function (cell) {
          var value = cell === undefined ? "" : String(cell);
          if (value.indexOf("\"") >= 0 || value.indexOf(",") >= 0) {
            value = "\"" + value.replace(/\"/g, "\"\"") + "\"";
          }
          return value;
        })
        .join(",");
    })
    .join("\n");

  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  download_link.href = URL.createObjectURL(blob);
}

function collect_measurements_data() {
  var data = [];
  if (aug_view === undefined) return data;
  var model = aug_view.getModel();
  var factor = aug_view.getUnitsPerPixel();
  var show_deltas = document.getElementById("show-deltas").checked;
  var index = 1;
  model.forAllLines(function (line) {
    var dx = (line.p2.x - line.p1.x) * factor;
    var dy = (line.p2.y - line.p1.y) * factor;
    var length_value = (factor * line.length()).toPrecision(4) + " mm";
    var entry = {
      index: index,
      length: length_value,
      dx: (dx.toPrecision(4)) + " mm",
      dy: (dy.toPrecision(4)) + " mm",
      show_deltas: show_deltas,
      is_scale: line.is_scale === true,
    };
    data.push(entry);
    index += 1;
  });
  return data;
}

function update_measurements_table() {
  var list = document.getElementById("measurements-list");
  var scale = document.getElementById("measurements-scale");
  if (!list) return;
  var data = collect_measurements_data();
  if (scale) {
    var units_per_pixel = aug_view.getUnitsPerPixel();
    scale.textContent =
      "Scale: 1 px = " + units_per_pixel.toPrecision(4) + " mm";
  }
  list.innerHTML = "";

  if (data.length === 0) {
    var empty = document.createElement("li");
    empty.textContent = "No measurements yet";
    list.appendChild(empty);
    return;
  }

  for (var i = 0; i < data.length; ++i) {
    var entry = data[i];
    var item = document.createElement("li");
    var label = entry.is_scale ? "Pomiar do skali" : "Pomiar";
    var text = label + " " + entry.index + ": " + entry.length;
    if (entry.show_deltas) {
      text += " (dx=" + entry.dx + ", dy=" + entry.dy + ")";
    }
    item.textContent = text;
    if (entry.is_scale) {
      item.style.color = "#7CFFB2";
    }
    list.appendChild(item);
  }
}

function layout_measurements_table(data) {
  var line_height = 18;
  var padding = 10;
  var title_height = 22;
  var scale_height = 18;
  var width = 260;
  var height =
    title_height +
    scale_height +
    padding * 2 +
    Math.max(1, data.length) * line_height;
  return {
    width: width,
    height: height,
    line_height: line_height,
    padding: padding,
    title_height: title_height,
    scale_height: scale_height,
    data: data,
  };
}

function draw_measurements_table(ctx, offset_x, offset_y, layout) {
  ctx.save();
  ctx.translate(offset_x, offset_y);

  ctx.fillStyle = "#3c3c3c";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.strokeStyle = "#444";
  ctx.strokeRect(0.5, 0.5, layout.width - 1, layout.height - 1);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Sans Serif";
  ctx.fillText("Measurements", layout.padding, layout.padding + 14);

  ctx.font = "12px Sans Serif";
  var units_per_pixel = aug_view.getUnitsPerPixel();
  var scale_text = "Scale: 1 px = " + units_per_pixel.toPrecision(4) + " mm";
  var y = layout.padding + layout.title_height;
  ctx.fillStyle = "#ddd";
  ctx.fillText(scale_text, layout.padding, y + 12);
  y += layout.scale_height;
  ctx.fillStyle = "#fff";
  if (layout.data.length === 0) {
    ctx.fillText("No measurements yet", layout.padding, y + 12);
  } else {
    for (var i = 0; i < layout.data.length; ++i) {
      var entry = layout.data[i];
      var label = entry.is_scale ? "Pomiar do skali" : "Pomiar";
      var text = label + " " + entry.index + ": " + entry.length;
      if (entry.show_deltas) {
        text += " (dx=" + entry.dx + ", dy=" + entry.dy + ")";
      }
      if (entry.is_scale) {
        ctx.fillStyle = "#7CFFB2";
      } else {
        ctx.fillStyle = "#fff";
      }
      ctx.fillText(text, layout.padding, y + 12);
      y += layout.line_height;
    }
  }

  ctx.restore();
}

function load_background_image(chooser) {
  if (chooser.value == "" || !chooser.files[0].type.match(/image.*/)) return;

  var img_reader = new FileReader();
  img_reader.readAsDataURL(chooser.files[0]);
  img_reader.onload = function (e) {
    var new_img = new Image();
    // Image loading in the background canvas. Once we have the image, we
    // can size the canvases to a proper size.
    var background_canvas = document.getElementById("background-img");
    new_img.onload = function () {
      var bg_context = background_canvas.getContext("2d");
      background_canvas.width = new_img.width;
      background_canvas.height = new_img.height;
      bg_context.drawImage(new_img, 0, 0);

      aug_view.resetWithSize(new_img.width, new_img.height);

      help_system.achievementUnlocked(HelpLevelEnum.DONE_FILE_LOADING);
      backgroundImage = new_img;
      init_download(chooser.files[0].name);
    };
    new_img.src = e.target.result;
  };
}
