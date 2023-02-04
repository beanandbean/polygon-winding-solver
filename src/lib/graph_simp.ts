import Denque from "denque";
import { EdgeIndex } from "./triangulate";
import { PointEntry } from "./adj_graph";
import LoopList, { buildLoop, LoopNode } from "./loop_list";
import { area, forEachPair, isZero } from "./utils";

export type Result = {
  loops: number[][];

  edges: EdgeIndex[];
  conns: EdgeIndex[];
};

class NodeVisit {
  // `from === -1` means this is a forced visit, i.e. the node is accessed
  // by flooding on a boundary
  from: number;
  hitBoundary: boolean;

  constructor(from: number, hitBoundary: boolean) {
    this.from = from;
    this.hitBoundary = hitBoundary;
  }
}

export default class GraphSimplifier {
  entries: PointEntry[];
  loops: LoopNode[];

  constructor(loops: LoopList) {
    this.entries = loops.entries;
    this.loops = loops.loops;
  }

  // if `joinLoops` is set to true, construct a minimum spanning tree
  // connecting all edges with precisely one side of winding number zero;
  // otherwise, simply output such edges without connecting them.
  // adjacent colinear edges will always be joined here
  runSimplifyGraph(joinLoops: boolean = true): Result {
    let startIndex = -1;
    let edgesTotal = 0;
    const conns = new Array<EdgeIndex>();
    const nodeConnections = this.entries.map(() => 0);
    for (const [i, iEntry] of this.entries.entries()) {
      for (const [j, path] of iEntry.conns.entries()) {
        if (this.loops[path.loop]!.winding === 0) {
          const opposite = this.entries[j]!.conns.get(i)!;
          if (this.loops[opposite.loop]!.winding === 0) {
            if (!path.ignore && i < j) {
              conns.push([i, j]);
              nodeConnections[i] += 1;
              nodeConnections[j] += 1;
            }
          } else {
            if (!joinLoops) {
              opposite.inSimplified = true;
            } else if (startIndex === -1) {
              startIndex = i;
            }
            opposite.isBoundary = true;
            edgesTotal += 1;
            nodeConnections[i] += 1;
            nodeConnections[j] += 1;
          }
        }
      }
    }

    // use auxiliary edges to connect edge loops,
    // so we do not need geometry to decide loop containment
    if (startIndex !== -1) {
      type NextVisit = { node: number; nextDir: number };

      const growth = new Map<number, NodeVisit>();
      const visits = new Array<number>();
      const nextVisits = new Denque<NextVisit>();
      let edgesFound = 0;
      const visitBoundaryCluster = (
        i: number,
        from: number,
        growth: Map<number, NodeVisit>,
        visits: number[],
        nextVisits: Denque<NextVisit>
      ) => {
        let count = 0;

        const nexts = new Denque<number>();
        const visit = (i: number, nexts: Denque<number>) => {
          const node = this.entries[i]!;
          for (const [j, path] of node.conns.entries()) {
            if (path.isBoundary) {
              if (!path.inSimplified) {
                path.inSimplified = true;
                count += 1;
                nexts.push(j);
              }
            } else {
              const opposite = this.entries[j]!.conns.get(i)!;
              if (opposite.isBoundary && !opposite.inSimplified) {
                opposite.inSimplified = true;
                count += 1;
                nexts.push(j);
              }
            }
          }
        };

        visit(i, nexts);
        if (from !== -1) {
          visits.push(i);
        }
        nextVisits.push({ node: i, nextDir: 0 });
        if (nexts.length > 0) {
          growth.set(i, new NodeVisit(from, true));
          while (nexts.length > 0) {
            const nextIndex = nexts.shift()!;
            if (!growth.has(nextIndex)) {
              growth.set(nextIndex, new NodeVisit(-1, true));
              nextVisits.push({ node: nextIndex, nextDir: 0 });
              visit(nextIndex, nexts);
            }
          }
        } else {
          growth.set(i, new NodeVisit(from, false));
        }

        return count;
      };

      edgesFound += visitBoundaryCluster(
        startIndex,
        -1,
        growth,
        visits,
        nextVisits
      );
      while (nextVisits.length > 0 && edgesFound < edgesTotal) {
        const nextVisit = nextVisits.peekFront()!;
        const node = this.entries[nextVisit.node]!;
        if (nextVisit.nextDir < node.directions.length) {
          const j = node.directions[nextVisit.nextDir]!;
          nextVisit.nextDir += 1;
          if (!growth.has(j)) {
            node.conns.get(j)!.inSimplified = true;
            this.entries[j]!.conns.get(nextVisit.node)!.inSimplified = true;
            edgesFound += visitBoundaryCluster(
              j,
              nextVisit.node,
              growth,
              visits,
              nextVisits
            );
          }
        } else {
          nextVisits.shift();
        }
      }

      // remove unnecessary connections that does not lead to a boundary
      for (const visit of visits.reverse()) {
        const node = growth.get(visit)!;
        if (node.hitBoundary) {
          growth.get(node.from)!.hitBoundary = true;
        } else {
          this.entries[node.from]!.conns.get(visit)!.inSimplified = false;
          this.entries[visit]!.conns.get(node.from)!.inSimplified = false;
        }
      }
    }

    const loops = new Array<number[]>();
    const edges = new Array<EdgeIndex>();
    for (const [i, entry] of this.entries.entries()) {
      for (const [j, path] of entry.conns.entries()) {
        if (path.isBoundary && !path.loopVisited) {
          const loop = buildLoop(
            [i, j],
            this.entries,
            (path) => path.inSimplified
          );

          forEachPair(
            loop.values(),
            (prev, current) => {
              this.entries[prev]!.conns.get(current)!.loopVisited = true;
            },
            true
          );

          // remove adjacent colinear edges
          const keepNode = loop.map(() => true);
          let firstBoundaryEnd = -1;
          let prevBounaryStart = -1;
          let prevEntry = this.entries[loop[loop.length - 1]!]!;
          for (const [i, current] of loop.entries()) {
            const currentEntry = this.entries[current]!;
            const next = loop[(i + 1) % loop.length]!;

            const prevPath = prevEntry.conns.get(current)!;
            const currentPath = currentEntry.conns.get(next)!;
            if (
              prevPath.isBoundary === currentPath.isBoundary &&
              nodeConnections[current] === 2 &&
              isZero(
                area(
                  prevEntry.coord,
                  currentEntry.coord,
                  this.entries[next]!.coord
                )
              )
            ) {
              keepNode[i] = false;
            } else {
              if (prevPath.isBoundary) {
                if (prevBounaryStart === -1) {
                  firstBoundaryEnd = current;
                } else {
                  edges.push([prevBounaryStart, current]);
                }
              }

              if (currentPath.isBoundary) {
                prevBounaryStart = current;
              }
            }

            prevEntry = currentEntry;
          }
          if (prevBounaryStart !== -1 && firstBoundaryEnd !== -1) {
            edges.push([prevBounaryStart, firstBoundaryEnd]);
          }

          loops.push(loop.filter((_, i) => keepNode[i]));
        }
      }
    }

    return {
      loops,
      edges,
      conns,
    };
  }
}
