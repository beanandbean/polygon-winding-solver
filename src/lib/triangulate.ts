import AdjacencyGraph from "./adj_graph";
import { LoopForest } from "./loop_forest";
import { Point } from "./utils";

// throughout whole implementation we assume the following axes direction:
// positive-x is towards the right, positive-y is towards the bottom.
// also assumed positive winding number means clockwise

export type Result = {
  trigs: Triangle[];

  // `edges` are counter-clockwise around triangulated region
  edges: [Point, Point][];
  // `conns` contains edges whose both sides have winding number zero
  conns: [Point, Point][];
};

export type Triangle = [Point, Point, Point];
export interface Triangulator {
  // assumes `loop` is clockwise, `holes` are counterclockwise
  triangulate(loop: Point[], holes: Point[][]): Triangle[];
}

const triangulate = (
  paths: Point[][],
  triangulator: Triangulator,
  // set `cleanup` to `true` to pass through loop builder twice,
  // which will result in a simplified graph and fewer triangles
  cleanup: boolean = false
): Result => {
  const graph = new AdjacencyGraph();
  for (const path of paths) {
    graph.addPath(path);
  }
  graph.computeDirections();

  let loopForest = new LoopForest(graph.entries);
  loopForest.buildLoops();
  loopForest.computeWindingNumbers();

  const edges = new Array<[Point, Point]>();
  const conns = new Array<[Point, Point]>();
  for (const [i, iEntry] of graph.entries.entries()) {
    for (const [j, path] of iEntry.conns.entries()) {
      const winding = loopForest.windingNumberForLoop(path.loop);
      if (winding === 0) {
        const jEntry = graph.entries[j]!;
        const opposite = loopForest.windingNumberForLoop(
          jEntry.conns.get(i)!.loop
        );
        if (opposite === 0) {
          if (i < j) {
            conns.push([iEntry.coord, jEntry.coord]);
          }
        } else {
          edges.push([iEntry.coord, jEntry.coord]);
        }
      }
    }
  }

  if (cleanup) {
    // after getting winding numbers, rebuild graph and loop forest
    // using only edges with non-zero winding numbers on one side
    const removes = graph.entries.map(() => new Set<number>());
    for (const [i, iEntry] of graph.entries.entries()) {
      for (const [j, path] of iEntry.conns.entries()) {
        if (i < j) {
          const winding = loopForest.windingNumberForLoop(path.loop);
          const opposite = loopForest.windingNumberForLoop(
            graph.entries[j]!.conns.get(i)!.loop
          );
          if (
            (winding === 0 && opposite === 0) ||
            (winding !== 0 && opposite !== 0)
          ) {
            removes[i]!.add(j);
            removes[j]!.add(i);
          }
        }
      }
    }

    for (const [i, iEntry] of graph.entries.entries()) {
      const r = removes[i]!;
      if (r.size > 0) {
        for (const remove of r) {
          iEntry.conns.delete(remove);
        }
        iEntry.directions = iEntry.directions.filter((i) => !r.has(i));
      }

      for (const path of iEntry.conns.values()) {
        path.loop = undefined;
      }
    }

    loopForest = new LoopForest(graph.entries);
    loopForest.buildLoops();
    loopForest.computeWindingNumbers(true);
  }

  const trigs = [];
  for (const node of loopForest.loops) {
    for (const interior of node.interior) {
      if (interior.winding !== 0) {
        const loop = interior.loop.map((index) => graph.entries[index]!.coord);
        const holes = interior.children.map((n) =>
          loopForest.loops[n]!.exterior.map(
            (index) => graph.entries[index]!.coord
          )
        );
        trigs.push(...triangulator.triangulate(loop, holes));
      }
    }
  }

  return { trigs, edges, conns };
};
export default triangulate;
