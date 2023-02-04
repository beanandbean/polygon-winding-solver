import triangulate, { Triangle, Triangulator } from "./lib/triangulate";
import { sqrDist, Point } from "./lib/utils";
import earcut, { flatten } from "earcut";

class EarcutTriangulator implements Triangulator {
  triangulate(loop: Point[], holes: Point[][]) {
    const data = flatten(
      [loop, ...holes].map((loop) => loop.map((p) => [p.x, p.y]))
    );
    const verts = earcut(data.vertices, data.holes, data.dimensions);

    const vertex = (index: number): Point => ({
      x: data.vertices[index * data.dimensions]!,
      y: data.vertices[index * data.dimensions + 1]!,
    });

    const trigs = new Array<Triangle>();
    for (let i = 0; i + 2 < verts.length; i += 3) {
      trigs.push([
        vertex(verts[i]!),
        vertex(verts[i + 1]!),
        vertex(verts[i + 2]!),
      ]);
    }
    return trigs;
  }
}

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const context = canvas.getContext("2d")!;

let paths = new Array<Point[]>();

const drawTriangle = (context: CanvasRenderingContext2D, points: Triangle) => {
  context.moveTo(points[0].x, points[0].y);
  context.lineTo(points[1].x, points[1].y);
  context.lineTo(points[2].x, points[2].y);
  context.lineTo(points[0].x, points[0].y);
};

const drawEdge = (
  context: CanvasRenderingContext2D,
  points: [Point, Point]
) => {
  context.moveTo(points[0].x, points[0].y);
  context.lineTo(points[1].x, points[1].y);
};

const drawPoint = (
  context: CanvasRenderingContext2D,
  point: Point,
  radius: number
) => {
  context.moveTo(point.x, point.y);
  context.arc(point.x, point.y, radius, 0, 2 * Math.PI);
};

const draw = () => {
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "black";
  context.font = "20px sans-serif";
  const texts = [
    "Click to add a point",
    "Shift+click to start new path",
    "Ctrl+click to erase",
    "Hold alt to snap to grid",
  ];
  for (const [i, text] of texts.entries()) {
    context.fillText(text, 20, 40 + i * 20);
  }

  const computed = triangulate(paths, new EarcutTriangulator(), true);
  console.log(`${computed.trigs.length} triangles!`);

  context.fillStyle = "#99FF99";
  context.beginPath();
  for (const trig of computed.trigs) {
    drawTriangle(context, trig);
  }
  context.fill();

  context.lineWidth = 1;
  context.strokeStyle = "#666666";
  context.beginPath();
  for (const trig of computed.trigs) {
    drawTriangle(context, trig);
  }
  context.stroke();

  context.lineWidth = 2;
  context.strokeStyle = "#990000";
  context.beginPath();
  for (const edge of computed.edges) {
    drawEdge(context, edge);
  }
  context.stroke();

  context.strokeStyle = "#ff0000";
  context.beginPath();
  for (const edge of computed.conns) {
    drawEdge(context, edge);
  }
  context.stroke();

  context.fillStyle = "black";
  context.beginPath();
  for (const edge of computed.edges) {
    drawPoint(context, edge[0], 3);
    drawPoint(context, edge[1], 3);
  }
  for (const edge of computed.conns) {
    drawPoint(context, edge[0], 3);
    drawPoint(context, edge[1], 3);
  }
  context.fill();

  context.fillStyle = "#0000cc";
  context.beginPath();
  for (const path of paths) {
    for (const point of path) {
      drawPoint(context, point, 4);
    }
  }
  context.fill();
};

canvas.addEventListener("mousedown", (event) => {
  if (event.button == 0) {
    let x = event.clientX;
    let y = event.clientY;
    if (event.altKey) {
      x = Math.round(x / 50) * 50;
      y = Math.round(y / 50) * 50;
    }

    if (event.shiftKey) {
      paths.push([{ x, y }]);
    } else if (event.ctrlKey) {
      const newPaths = new Array<Point[]>();
      for (const path of paths) {
        const newPath = new Array<Point>();
        for (const point of path) {
          const sqrd = sqrDist(point, { x, y });
          if (sqrd > Math.pow(10, 2)) {
            newPath.push(point);
          }
        }
        if (newPath.length > 0) {
          newPaths.push(newPath);
        }
      }
      paths = newPaths;
    } else {
      if (paths.length === 0) {
        paths.push([]);
      }
      paths[paths.length - 1]!.push({ x, y });
    }

    draw();
  }
});

const resizeCanvas = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  draw();
};

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
