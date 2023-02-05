import earcut, { flatten } from "earcut";
import cdt2d from "cdt2d";
import triangulate, {
  Edge,
  EdgeIndex,
  LoopTriangulator,
  PlaneGraphTriangulator,
  Point,
  Triangle,
  Triangulator,
  TriangulatorType,
} from "../..";

class EarcutTriangulator implements LoopTriangulator {
  readonly type = TriangulatorType.loop;

  triangulate(points: Point[], loop: number[]) {
    const data = flatten([loop.map((p) => [points[p]!.x, points[p]!.y])]);
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

class CDT2DTriangulator implements PlaneGraphTriangulator {
  readonly type = TriangulatorType.planeGraph;

  triangulate(points: Point[], edges: EdgeIndex[]) {
    const pointArray = points.map<EdgeIndex>((p) => [p.x, p.y]);
    const trigs = cdt2d(pointArray, edges, { exterior: false });
    return trigs.map<Triangle>((t) => [
      points[t[0]]!,
      points[t[1]]!,
      points[t[2]]!,
    ]);
  }
}

const TRIANGULATORS: {
  [key: string]: Triangulator;
} = {
  earcut: new EarcutTriangulator(),
  cdt2d: new CDT2DTriangulator(),
};
let triangulator: Triangulator | undefined = undefined;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const context = canvas.getContext("2d")!;

let paths = new Array<Point[]>();

const drawTriangle = (context: CanvasRenderingContext2D, points: Triangle) => {
  context.moveTo(points[0].x, points[0].y);
  context.lineTo(points[1].x, points[1].y);
  context.lineTo(points[2].x, points[2].y);
  context.lineTo(points[0].x, points[0].y);
};

const drawEdge = (context: CanvasRenderingContext2D, points: Edge) => {
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

  const computed =
    triangulator === undefined
      ? triangulate(paths)
      : triangulate(paths, triangulator);
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
          const sqrd = Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2);
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

for (const elem of document.querySelectorAll('input[name="trig"]')) {
  const input = elem as HTMLInputElement;
  if (input.checked) {
    triangulator = TRIANGULATORS[input.value];
  }

  input.addEventListener("change", () => {
    if (input.checked) {
      triangulator = TRIANGULATORS[input.value];
      draw();
    }
  });
}

const resizeCanvas = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  draw();
};

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
