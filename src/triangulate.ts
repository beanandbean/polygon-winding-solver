import AdjacencyGraph, { PointEntry } from "./adj_graph";
import LoopList from "./loop_list";
import GraphSimplifier from "./graph_simp";
import EarcutTriangulator from "./earcut";
import { Edge, Point, Triangle } from "./utils";

// throughout whole implementation we assume the following axes direction:
// positive-x is towards the right, positive-y is towards the bottom.
// also assumed positive winding number means clockwise

export enum TriangulatorType {
  planeGraph,
  loop,
}

export type EdgeIndex = [number, number];

export interface PlaneGraphTriangulator {
  readonly type: TriangulatorType.planeGraph;

  // this triangulator triangulates a whole graph simultaneously;
  // interior is decided using even-odd rule.
  // can assume that `edges` are clockwise around the interior
  triangulate(points: Point[], edges: EdgeIndex[]): Triangle[];
}

export interface LoopTriangulator {
  readonly type: TriangulatorType.loop;

  // this triangulator triangulates a loop at a time;
  // assumes points in `loop` are in clockwise order
  triangulate(points: Point[], loop: number[]): Triangle[];
}

export type Triangulator = PlaneGraphTriangulator | LoopTriangulator;

class PointTranslator {
  entries: PointEntry[];

  points = new Array<Point>();
  indices = new Map<number, number>();

  constructor(entries: PointEntry[]) {
    this.entries = entries;
  }

  translate(i: number) {
    if (!this.indices.has(i)) {
      this.indices.set(i, this.points.length);
      this.points.push(this.entries[i]!.coord);
    }
    return this.indices.get(i)!;
  }
}

export type Result = {
  trigs: Triangle[];

  // `edges` are exterior edges, in clockwise direction around triangulated region
  edges: Edge[];
  // `conns` contains edges whose both sides are exterior regions
  conns: Edge[];
};

const triangulate = (
  paths: Point[][],
  triangulator: Triangulator = new EarcutTriangulator()
): Result => {
  const graph = new AdjacencyGraph();
  for (const path of paths) {
    graph.addPath(path);
  }
  graph.connectPaths();
  graph.computeDirections();

  const loopList = new LoopList(graph);
  loopList.buildLoops();
  loopList.computeWindingNumbers();

  const graphSimplifier = new GraphSimplifier(loopList);
  const result = graphSimplifier.runSimplifyGraph(
    triangulator.type === TriangulatorType.loop
  );

  let trigs: Triangle[];
  if (triangulator.type === TriangulatorType.planeGraph) {
    const translator = new PointTranslator(graph.entries);
    const edges = result.edges.map<EdgeIndex>((edge) => [
      translator.translate(edge[0]),
      translator.translate(edge[1]),
    ]);
    trigs = triangulator.triangulate(translator.points, edges);
  } else {
    trigs = [];
    for (const loop of result.loops) {
      const translator = new PointTranslator(graph.entries);
      const loopIndices = loop.map((i) => translator.translate(i));

      trigs.push(...triangulator.triangulate(translator.points, loopIndices));
    }
  }

  return {
    trigs,
    edges: result.edges.map((edge) => [
      graph.entries[edge[0]]!.coord,
      graph.entries[edge[1]]!.coord,
    ]),
    conns: result.conns.map((edge) => [
      graph.entries[edge[0]]!.coord,
      graph.entries[edge[1]]!.coord,
    ]),
  };
};
export default triangulate;
