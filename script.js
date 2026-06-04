// This is your playground!
// Add functionality to your html controls, play with cytoscape's events and make those magic lenses!

/* global fetch, cytoscape */
import _style from "./style.js";
import { default as d3Fisheye } from "./libs/d3-fisheye-2.1.2.js";
import { default as _ } from "./libs/underscore-1.13.6.js";

async function getData() {
  const _data = await (await fetch("data/data.json")).json();
  const football = await (await fetch("data/football.json")).json();
  const data = [];

  football.nodes.forEach((n) => {
    data.push({
      data: {
        id: n.id,
        name: n.label,
        mins: n.mins_played || 0,
      },
      group: "nodes",
    });
  });

  football.edges.forEach((n) => {
    data.push({
      data: {
        id: n.id,
        source: n.src,
        target: n.dst,
        weight: n.val,
      },
      group: "edges",
    });
  });

  return data;
}

// returns true if the point "p" is inside the circle defined by "c" (center) and "r" (radius)
function isInCircle(c, r, p) {
  return Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2) <= Math.pow(r, 2);
}

// returns the nodes that are visible 
function nodesInView(cy) {
  const ext = cy.extent();

  return cy.nodes().filter(n => {
    const bb = n.boundingBox()
    return bb.x1 > ext.x1 && bb.x2 < ext.x2 && bb.y1 > ext.y1 && bb.y2 < ext.y2
  })
}

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
  
  layout.run(); // emits special events! 
  
  cy.style(_style);
  
  cy.on("zoom", e => {
    const zoom_level = cy.zoom();
    console.log(`Zoom level: ${zoom_level}`);
    
    /* 
      Your code goes here! 

      HINTs: 
        1. cy.zoom() returns the current zoom level. Notice how it changes while the layout is simulated! 
        2. This line above `cy.style(_style)`, loads the stylesheet from style.js, which you may also edit for the magic lenses later. You can load other stylesheets! 
        3. Use `nodesInView` to get a selection of only the nodes within the viewport
        4. For the radar charts, use the RadarChart function from /libs. See how it is used in: https://gist.github.com/nbremer/21746a9668ffdf6d8242 
    */

  });

  cy.on("mousemove", _.throttle(e => {
    const mouse = { x: e.originalEvent.x, y: e.originalEvent.y };
    console.log(`Mouse position: [x: ${mouse.x}, y: ${mouse.y}]`);

    cy.nodes().forEach((n) => {
      const node = n.renderedPosition(); // Careful: other position functions may invoke different coordinate systems

      // console.log(`Node position: [x: ${node.x}, y: ${node.y}]`);
    });
    
    /* 
      Your code also goes here! 

      HINTs: 
        1. use the "isInCircle" function defined above to calculate whether a node is inside the lens! 
        2. if you experience performance issues, use cy.startBatch() and cy.endBatch() to avoid unnecessary canvas redraws. See https://js.cytoscape.org/#cy.batch for more
        3. see below how to get the mouse and node positions
    */
  }, 100));
  
}

main();
