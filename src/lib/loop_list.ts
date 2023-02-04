import Denque from "denque";
import { EdgeIndex } from "./triangulate";
import AdjacencyGraph, { PathEntry, PointEntry } from "./adj_graph";
import { area, forEachPair, Point } from "./utils";

export class LoopNode {
  loop: number[];

  // winding number will be computed after all loops are built
  winding: number | undefined = undefined;

  constructor(loop: number[]) {
    this.loop = loop;
  }
}

export const buildLoop = (
  start: EdgeIndex,
  entries: PointEntry[],
  filter: ((path: PathEntry) => boolean) | undefined = undefined
) => {
  const loop = Array.from(start);
  while (true) {
    const current = loop[loop.length - 1]!;
    const currentEntry = entries[current]!;

    let index = 0;
    while (
      index < currentEntry.directions.length &&
      currentEntry.directions[index] !== loop[loop.length - 2]
    ) {
      index += 1;
    }
    index = (index + 1) % currentEntry.directions.length;
    while (
      filter !== undefined &&
      !filter(currentEntry.conns.get(currentEntry.directions[index]!)!)
    ) {
      index = (index + 1) % currentEntry.directions.length;
    }
    const next = currentEntry.directions[index]!;
    if (loop[loop.length - 1] === loop[0] && next === loop[1]) {
      loop.pop();
      return loop;
    } else {
      loop.push(next);
    }
  }
};

export default class LoopList {
  entries: PointEntry[];
  loops = [new LoopNode([])]; // placeholder for exterior always exists

  // assumes that 1) graph is connected, i.e. `adjGraph.connectPaths` has run
  // 2) directions are computed on the graph, i.e. `adjGraph.computeDirections` has run
  constructor(adjGraph: AdjacencyGraph) {
    this.entries = adjGraph.entries;
  }

  buildLoops() {
    for (const [i, entry] of this.entries.entries()) {
      for (const [j, path] of entry.conns.entries()) {
        if (path.loop === -1) {
          const loop = buildLoop([i, j], this.entries);

          // test exterior/interior
          let leftIndices = new Array<number>();
          let leftNode = -1;
          let leftCoord: Point = { x: 0, y: 0 };
          for (const [i, index] of loop.entries()) {
            if (index == leftNode) {
              leftIndices.push(i);
            } else {
              const entry = this.entries[index]!;
              if (
                leftNode === -1 ||
                entry.coord.x < leftCoord.x ||
                (entry.coord.x === leftCoord.x && entry.coord.y < leftCoord.y)
              ) {
                leftIndices = [i];
                leftNode = index;
                leftCoord = entry.coord;
              }
            }
          }
          let isExterior = false;
          for (const leftIndex of leftIndices) {
            const prevIndex = (leftIndex + loop.length - 1) % loop.length;
            const prevEntry = this.entries[loop[prevIndex]!]!;
            const nextIndex = (leftIndex + 1) % loop.length;
            const nextEntry = this.entries[loop[nextIndex]!]!;
            if (
              loop[prevIndex] === loop[nextIndex] ||
              area(prevEntry.coord, leftCoord, nextEntry.coord) > 0
            ) {
              isExterior = true;
              break;
            }
          }

          const node = new LoopNode(loop);
          if (isExterior) {
            this.loops[0] = node;
          } else {
            this.loops.push(node);
          }

          // mark edges in `adjGraph` as visited
          const index = isExterior ? 0 : this.loops.length - 1;
          forEachPair(
            loop.values(),
            (prev, current) => {
              this.entries[prev]!.conns.get(current)!.loop = index;
            },
            true
          );
        }
      }
    }
  }

  computeWindingNumbers() {
    this.loops[0]!.winding = 0;
    const nextLoops = new Denque([0]);
    while (nextLoops.length > 0) {
      const index = nextLoops.shift()!;
      const loop = this.loops[index]!;
      forEachPair(
        loop.loop.values(),
        (prev, current) => {
          const entry = this.entries[current]!.conns.get(prev)!;
          if (entry.loop !== -1) {
            const loopEntry = this.loops[entry.loop]!;
            if (loopEntry.winding === undefined) {
              loopEntry.winding = loop.winding! + entry.repeat;
              nextLoops.push(entry.loop);
            }
          }
        },
        true
      );
    }
  }
}
