import { PointEntry } from "./adj_graph";
import { area, forEachPair, loopContains, Point } from "./utils";

export enum LoopType {
  exterior,
  interior,
}

export type LoopIndex = {
  node: number;
  loop:
    | { type: LoopType.exterior }
    | { type: LoopType.interior; index: number };
};

export class InteriorNode {
  loop: number[];
  children = new Array<number>();

  // winding number will be computed after the forest is built
  winding: number | undefined = undefined;

  constructor(loop: number[]) {
    this.loop = loop;
  }
}

export type InteriorIndex = { node: number; interior: number };

export type LoopNode = {
  parent: InteriorIndex | undefined;
  exterior: number[];
  interior: InteriorNode[];
};

export class LoopForest {
  adjGraph: Array<PointEntry>;
  loops = new Array<LoopNode>();

  // assumes that directions are computed on the graph
  constructor(adjGraph: Array<PointEntry>) {
    this.adjGraph = adjGraph;
  }

  private getCoords(loop: number[]) {
    return loop.map((index) => this.adjGraph[index]!.coord);
  }

  buildLoops() {
    const addToPool = (
      pool: Array<[number, number]>,
      index: number,
      entry: PointEntry
    ) => {
      for (const [to, path] of entry.conns) {
        if (path.loop === undefined) {
          pool.push([index, to]);
        }
      }
    };

    for (const [i, entry] of this.adjGraph.entries()) {
      let exterior = new Array<number>();
      let interiors = new Array<InteriorNode>();
      const pool = new Array<[number, number]>();
      addToPool(pool, i, entry);
      while (pool.length > 0) {
        const edge = pool.pop()!;
        if (this.adjGraph[edge[0]]!.conns.get(edge[1])!.loop === undefined) {
          const loop = [edge[0], edge[1]];
          while (true) {
            const current = loop[loop.length - 1]!;
            const currentEntry = this.adjGraph[current]!;
            if (current !== loop[0]) {
              addToPool(pool, current, currentEntry);
            }

            let index = 0;
            while (
              index < currentEntry.directions.length &&
              currentEntry.directions[index] !== loop[loop.length - 2]
            ) {
              index += 1;
            }
            const next =
              currentEntry.directions[
                (index + 1) % currentEntry.directions.length
              ]!;
            if (loop[loop.length - 1] === loop[0] && next === loop[1]) {
              loop.pop();
              break;
            } else {
              loop.push(next);
            }
          }

          // test exterior/interior
          let leftIndex = -1;
          let leftCoord: Point = { x: 0, y: 0 };
          for (const [i, index] of loop.entries()) {
            const entry = this.adjGraph[index]!;
            if (
              leftIndex === -1 ||
              entry.coord.x < leftCoord.x ||
              (entry.coord.x === leftCoord.x && entry.coord.y < leftCoord.y)
            ) {
              leftIndex = i;
              leftCoord = entry.coord;
            }
          }
          const prevIndex = (leftIndex + loop.length - 1) % loop.length;
          const prevEntry = this.adjGraph[loop[prevIndex]!]!;
          const nextIndex = (leftIndex + 1) % loop.length;
          const nextEntry = this.adjGraph[loop[nextIndex]!]!;
          const isExterior =
            loop[prevIndex] === loop[nextIndex] ||
            area(prevEntry.coord, leftCoord, nextEntry.coord) > 0;

          if (isExterior) {
            exterior = loop;
          } else {
            const interior = new InteriorNode(loop);
            interiors.push(interior);

            const loopCoords = this.getCoords(loop);
            for (const [n, node] of this.loops.entries()) {
              if (node.parent === undefined) {
                const point = this.adjGraph[node.exterior[0]!]!.coord;
                if (loopContains(loopCoords, point)) {
                  node.parent = {
                    node: this.loops.length,
                    interior: interiors.length - 1,
                  };
                  interior.children.push(n);
                }
              }
            }
          }

          // mark edges in `adjGraph` as visited
          const loopIndex: LoopIndex = {
            node: this.loops.length,
            loop: isExterior
              ? { type: LoopType.exterior }
              : { type: LoopType.interior, index: interiors.length - 1 },
          };
          forEachPair(
            loop.values(),
            (prev, current) => {
              this.adjGraph[prev]!.conns.get(current)!.loop = loopIndex;
            },
            true
          );
        }
      }

      if (exterior.length > 0) {
        const point = this.adjGraph[exterior[0]!]!.coord;
        let parentNode = -1;
        let parentInterior = -1;
        let updated: boolean;
        do {
          updated = false;
          if (parentNode === -1) {
            for (const [i, loop] of this.loops.entries()) {
              if (loop.parent === undefined) {
                for (const [j, interior] of loop.interior.entries()) {
                  const interiorCoords = this.getCoords(interior.loop);
                  if (loopContains(interiorCoords, point)) {
                    parentNode = i;
                    parentInterior = j;
                    updated = true;
                    break;
                  }
                }
              }
            }
          } else {
            for (const i of this.loops[parentNode]!.interior[parentInterior]!
              .children) {
              for (const [j, interior] of this.loops[i]!.interior.entries()) {
                const interiorCoords = this.getCoords(interior.loop);
                if (loopContains(interiorCoords, point)) {
                  parentNode = i;
                  parentInterior = j;
                  updated = true;
                  break;
                }
              }
            }
          }
        } while (updated);

        // original siblings may actually be children of new node
        if (parentNode !== -1) {
          const parent = this.loops[parentNode]!.interior[parentInterior]!;
          const newChildren = [this.loops.length];
          for (const i of parent.children) {
            let moved = false;
            const siblingPoint =
              this.adjGraph[this.loops[i]!.exterior[0]!]!.coord;
            for (const [j, interior] of interiors.entries()) {
              const interiorCoords = this.getCoords(interior.loop);
              if (loopContains(interiorCoords, siblingPoint)) {
                interior.children.push(i);
                this.loops[i]!.parent = {
                  node: this.loops.length,
                  interior: j,
                };
                moved = true;
                break;
              }
            }
            if (!moved) {
              newChildren.push(i);
            }
          }
          parent.children = newChildren;
        }

        this.loops.push({
          parent:
            parentNode === -1
              ? undefined
              : {
                  node: parentNode,
                  interior: parentInterior,
                },
          exterior,
          interior: interiors,
        });
      }
    }
  }

  // `evenOddRule` should be set to true when the adjacency graph
  // has been pruned, so original winding numbers should be disregarded
  computeWindingNumbers(evenOddRule: boolean = false) {
    const loops = new Array<InteriorIndex>();
    const propagate = (
      loop: number[],
      winding: number,
      newLoops: InteriorIndex[]
    ) => {
      forEachPair(
        loop.values(),
        (prev, current) => {
          const entry = this.adjGraph[current]!.conns.get(prev)!;
          if (
            entry.loop !== undefined &&
            entry.loop.loop.type === LoopType.interior
          ) {
            const loopEntry =
              this.loops[entry.loop.node]!.interior[entry.loop.loop.index]!;
            if (loopEntry.winding === undefined) {
              loopEntry.winding = evenOddRule
                ? (winding + 1) % 2
                : winding + entry.repeat;
              newLoops.push({
                node: entry.loop.node,
                interior: entry.loop.loop.index,
              });
            }
          }
        },
        true
      );
    };

    for (const loop of this.loops) {
      if (loop.parent === undefined) {
        propagate(loop.exterior, 0, loops);
      }
    }
    while (loops.length > 0) {
      const loopIndex = loops.pop()!;
      const entry = this.loops[loopIndex.node]!.interior[loopIndex.interior]!;
      propagate(entry.loop, entry.winding!, loops);
      for (const child of entry.children) {
        propagate(this.loops[child]!.exterior, entry.winding!, loops);
      }
    }
  }

  windingNumberForLoop(loop: LoopIndex | undefined) {
    if (loop === undefined) {
      return 0;
    } else {
      const node = this.loops[loop.node]!;
      if (loop.loop.type === LoopType.exterior) {
        if (node.parent !== undefined) {
          return this.loops[node.parent.node]!.interior[node.parent.interior]!
            .winding!;
        } else {
          return 0;
        }
      } else {
        return node.interior[loop.loop.index]!.winding!;
      }
    }
  }
}
