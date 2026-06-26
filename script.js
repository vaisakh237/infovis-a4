// Assignment 4 - Semantic Zoom + Magic Lenses
// InfoVis TU Dresden SS2026

/* global fetch, cytoscape, RadarChart */
import _style from "./style.js";
import { default as _ } from "./libs/underscore-1.13.6.js";

// ─── Constants ───────────────────────────────────────────────────────────────
const META_KEYS = new Set(["id", "label"]);
const ZOOM_L1 = 0.4;
const ZOOM_L2 = 1.2;

// ─── Data Loading ────────────────────────────────────────────────────────────
async function getData() {
  const football = await (await fetch("data/football.json")).json();
  const data = [];

  football.nodes.forEach((n) => {
    const attrs = {};
    Object.entries(n).forEach(([k, v]) => {
      if (!META_KEYS.has(k)) attrs[k] = v;
    });
    const attrCount = Object.keys(attrs).length;

    data.push({
      data: {
        id: n.id,
        name: n.label,
        mins: n.mins_played || 0,
        attrs,
        attrCount,
      },
      group: "nodes",
    });
  });

  football.edges.forEach((e) => {
    data.push({
      data: {
        id: e.id,
        source: e.src,
        target: e.dst,
        weight: e.val,
      },
      group: "edges",
    });
  });

  return data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isInCircle(c, r, p) {
  return (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= r ** 2;
}

function nodesInView(cy) {
  const ext = cy.extent();
  return cy.nodes().filter((n) => {
    const bb = n.boundingBox();
    return bb.x1 > ext.x1 && bb.x2 < ext.x2 && bb.y1 > ext.y1 && bb.y2 < ext.y2;
  });
}

function nodeToRadarData(node) {
  const attrs = node.data("attrs");
  return [
    Object.entries(attrs).map(([axis, value]) => ({ axis, value: value || 0 })),
  ];
}

// ─── Radar Chart Management ──────────────────────────────────────────────────
const radarContainers = new Map();

function drawRadarOnNode(cy, node) {
  const nodeId = node.id();
  if (radarContainers.has(nodeId)) return;

  const pos = node.renderedPosition();
  const size = 80;

  const div = document.createElement("div");
  div.id = `radar-${nodeId}`;
  div.style.cssText = `
    position: absolute;
    left: ${pos.x - size / 2}px;
    top:  ${pos.y - size / 2}px;
    width: ${size}px;
    height: ${size}px;
    pointer-events: none;
    z-index: 5;
  `;
  document.body.appendChild(div);
  radarContainers.set(nodeId, div);

  RadarChart(`#radar-${nodeId}`, nodeToRadarData(node), {
    w: size, h: size,
    margin: { top: 5, right: 5, bottom: 5, left: 5 },
    levels: 2, labelFactor: 1.1, wrapWidth: 30,
    dotRadius: 2, strokeWidth: 1, opacityArea: 0.3,
  });
}

function removeAllRadars() {
  radarContainers.forEach((div) => div.remove());
  radarContainers.clear();
}

function repositionRadars(cy) {
  radarContainers.forEach((div, nodeId) => {
    const node = cy.getElementById(nodeId);
    if (!node || !node.length) return;
    const pos = node.renderedPosition();
    const size = parseInt(div.style.width);
    div.style.left = `${pos.x - size / 2}px`;
    div.style.top  = `${pos.y - size / 2}px`;
  });
}

// ─── Semantic Zoom ───────────────────────────────────────────────────────────
function applySemanticZoom(cy, zoomLevel, semanticZoomEnabled) {
  removeAllRadars();

  if (!semanticZoomEnabled) {
    cy.startBatch();
    cy.nodes().forEach((n) => {
      n.style({ display: "element", shape: "ellipse" });
    });
    cy.endBatch();
    return;
  }

  if (zoomLevel < ZOOM_L1) {
    // Level 0: only nodes with >=10 attrs, uniform style
    cy.startBatch();
    cy.nodes().forEach((n) => {
      const show = n.data("attrCount") >= 10;
      n.style({ display: show ? "element" : "none", shape: "ellipse" });
    });
    cy.endBatch();

  } else if (zoomLevel < ZOOM_L2) {
    // Level 1: all nodes, circles vs squares
    cy.startBatch();
    cy.nodes().forEach((n) => {
      const many = n.data("attrCount") >= 10;
      n.style({ display: "element", shape: many ? "ellipse" : "rectangle" });
    });
    cy.endBatch();

  } else {
    // Level 2: all nodes + radar charts on visible ones
    cy.startBatch();
    cy.nodes().forEach((n) => {
      n.style({ display: "element", shape: "ellipse" });
    });
    cy.endBatch();

    nodesInView(cy).forEach((n) => {
      if (n.data("attrCount") > 0) drawRadarOnNode(cy, n);
    });
  }
}

// ─── Magic Lens ──────────────────────────────────────────────────────────────
let lensRadius = 80;

function updateLens(cy, mouse, lensMode) {
  const lensEl = document.getElementById("lens");
  lensEl.setAttribute("cx", mouse.x);
  lensEl.setAttribute("cy", mouse.y);
  lensEl.setAttribute("r", lensRadius);

  cy.startBatch();

  if (lensMode === "node") {
    document.querySelectorAll(".lens-radar").forEach((el) => el.remove());

    cy.nodes().forEach((n) => {
      const pos = n.renderedPosition();
      if (isInCircle(mouse, lensRadius, pos) && n.data("attrCount") > 0) {
        const nodeId = n.id();
        if (!radarContainers.has(nodeId)) {
          const size = 80;
          const div = document.createElement("div");
          div.className = "lens-radar";
          div.id = `radar-lens-${nodeId}`;
          div.style.cssText = `
            position: absolute;
            left: ${pos.x - size / 2}px;
            top:  ${pos.y - size / 2}px;
            width: ${size}px;
            height: ${size}px;
            pointer-events: none;
            z-index: 6;
          `;
          document.body.appendChild(div);
          RadarChart(`#radar-lens-${nodeId}`, nodeToRadarData(n), {
            w: size, h: size,
            margin: { top: 5, right: 5, bottom: 5, left: 5 },
            levels: 2, labelFactor: 1.1, wrapWidth: 30,
            dotRadius: 2, strokeWidth: 1, opacityArea: 0.3,
          });
        }
      }
    });

  } else if (lensMode === "edge") {
    cy.edges().removeClass("magic");
    cy.nodes().forEach((n) => {
      const pos = n.renderedPosition();
      if (isInCircle(mouse, lensRadius, pos)) {
        n.connectedEdges().addClass("magic");
      }
    });
  }

  cy.endBatch();
}

function clearLens(cy) {
  document.querySelectorAll(".lens-radar").forEach((el) => el.remove());
  cy.edges().removeClass("magic");
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const data = await getData();

  const cy = cytoscape({
    container: document.getElementById("cy"),
    elements: data,
  });

  const layout = cy.layout({
    name: "cola",
    nodeSpacing: 50,
    edgeLength: 800,
    animate: true,
    randomize: false,
    maxSimulationTime: 2000,
  });

  layout.run();
  cy.style(_style);

  let semanticZoomEnabled = true;
  let lensMode = "edge";

  // ── UI Controls ──
  const config = document.getElementById("config");
  config.innerHTML = `
    <h3 style="margin:0 0 12px;font-size:14px;letter-spacing:.05em">Controls</h3>

    <label style="display:block;margin-bottom:4px;font-size:12px">
      Lens Radius: <span id="radius-val">${lensRadius}</span>px
    </label>
    <input id="radius-slider" type="range" min="30" max="300" value="${lensRadius}"
      style="width:100%;margin-bottom:14px">

    <label style="display:block;margin-bottom:14px;font-size:12px">
      <input id="sem-zoom-cb" type="checkbox" checked>
      Semantic Zoom
    </label>

    <label style="display:block;margin-bottom:4px;font-size:12px">Lens Mode</label>
    <select id="lens-mode" style="width:100%;background:#333;color:#fff;border:1px solid #666;padding:4px;font-size:12px">
      <option value="edge">Edge Highlight</option>
      <option value="node">Node Star Plot</option>
    </select>

    <div style="margin-top:20px;font-size:11px;color:#aaa;line-height:1.5">
      Zoom &lt; ${ZOOM_L1}: Level 0<br>
      ${ZOOM_L1}–${ZOOM_L2}: Level 1<br>
      Zoom &gt; ${ZOOM_L2}: Level 2
    </div>
  `;

  document.getElementById("radius-slider").addEventListener("input", (e) => {
    lensRadius = +e.target.value;
    document.getElementById("radius-val").textContent = lensRadius;
    document.getElementById("lens").setAttribute("r", lensRadius);
  });

  document.getElementById("sem-zoom-cb").addEventListener("change", (e) => {
    semanticZoomEnabled = e.target.checked;
    applySemanticZoom(cy, cy.zoom(), semanticZoomEnabled);
  });

  document.getElementById("lens-mode").addEventListener("change", (e) => {
    lensMode = e.target.value;
    clearLens(cy);
  });

  // ── Events ──
  cy.on("zoom pan", () => {
    applySemanticZoom(cy, cy.zoom(), semanticZoomEnabled);
    repositionRadars(cy);
  });

  cy.on("mousemove", _.throttle((e) => {
    const mouse = { x: e.originalEvent.clientX, y: e.originalEvent.clientY };
    updateLens(cy, mouse, lensMode);
  }, 50));

  cy.on("mouseout", () => clearLens(cy));

  layout.on("layoutstop", () => {
    applySemanticZoom(cy, cy.zoom(), semanticZoomEnabled);
  });
}

main();