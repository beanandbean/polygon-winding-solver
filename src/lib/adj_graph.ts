import { LoopIndex } from "./loop_forest";
import {
  contains,
  direction,
  equals,
  forEachPair,
  intersect,
  sqrDist,
  Point,
} from "./utils";

export class PathEntry {
  repeat: number;

  // direction will only be computed
  // after all intersections are processed
  direction = 0;

  loop: LoopIndex | undefined = undefined;

  constructor(repeat: number) {
    this.repeat = repeat;
  }
}

export class PointEntry {
  coord: Point;

  conns = new Map<number, PathEntry>();

  // stores connections sorted counter-clockwise
  directions = new Array<number>();

  constructor(coord: Point) {
    this.coord = coord;
  }

  // assumes all directions computed
  sortConns() {
    const dirs = Array.from(this.conns.entries());
    dirs.sort((a, b) => b[1].direction - a[1].direction);
    this.directions = dirs.map((path) => path[0]);
  }

  // methods below are all low-level
  // they do not attempt to sync the opposite path entry

  addPath(to: number, repeat: number) {
    this.conns.set(to, new PathEntry(repeat));
  }

  // this is used to shorten a path
  // when it is broken by an intermediate point
  shiftPath(from: number, to: number) {
    const path = this.conns.get(from)!;
    this.conns.delete(from);
    this.conns.set(to, path);
    return path;
  }
}

export default class AdjacencyGraph {
  entries = new Array<PointEntry>();

  // add a point to the graph, potentially a duplicate,
  // potentially breaking an existing path
  private addPoint(point: Point) {
    const breakPath = (index: number, current: PointEntry) => {
      for (const [i, iEntry] of this.entries.entries()) {
        for (const j of iEntry.conns.keys()) {
          const jEntry = this.entries[j]!;
          if (contains([iEntry.coord, jEntry.coord], current.coord)) {
            current.addPath(i, -iEntry.shiftPath(j, index).repeat);
            current.addPath(j, -jEntry.shiftPath(i, index).repeat);
            return;
          }
        }
      }
    };

    for (const [i, existing] of this.entries.entries()) {
      if (equals(point, existing.coord)) {
        return i;
      }
    }
    const index = this.entries.length;
    const entry = new PointEntry(point);
    breakPath(index, entry);
    this.entries.push(entry);
    return index;
  }

  private addEdge(start: number, end: number) {
    type PointWithDistance = {
      index: number;
      sqrDist: number;
    };

    if (start != end) {
      const intermediates = new Array<PointWithDistance>();

      // first step: find existing points on new edge
      const startEntry = this.entries[start]!;
      const endEntry = this.entries[end]!;
      const checked = this.entries.map(() => false);
      for (const [i, existing] of this.entries.entries()) {
        if (
          i === start ||
          i === end ||
          contains([startEntry.coord, endEntry.coord], existing.coord)
        ) {
          checked[i] = true;
          intermediates.push({
            index: i,
            sqrDist: sqrDist(existing.coord, startEntry.coord),
          });
        }
      }
      intermediates.sort((a, b) => a.sqrDist - b.sqrDist);

      // second step: find overlaps with existing edge
      const newIntermediates = new Array<PointWithDistance[]>();
      forEachPair(intermediates.values(), (prev, current) => {
        let prevEntry = this.entries[prev.index]!;
        const currentEntry = this.entries[current.index]!;
        if (prevEntry.conns.has(current.index)) {
          prevEntry.conns.get(current.index)!.repeat += 1;
          currentEntry.conns.get(prev.index)!.repeat -= 1;
        } else {
          const sqrd = sqrDist(currentEntry.coord, prevEntry.coord);
          newIntermediates.push([
            { index: prev.index, sqrDist: 0 },
            { index: current.index, sqrDist: sqrd },
          ]);
        }
      });

      if (newIntermediates.length > 0) {
        // third step: find intersections with existing edges
        for (const [i, iChecked] of checked.entries()) {
          if (!iChecked) {
            const iEntry = this.entries[i]!;
            for (const j of iEntry.conns.keys()) {
              if (j > i && j < checked.length && !checked[j]) {
                const jEntry = this.entries[j]!;
                for (const segment of newIntermediates) {
                  const startEntry = this.entries[segment[0]!.index]!;
                  const endEntry = this.entries[segment[1]!.index]!;

                  const intersection = intersect(
                    [iEntry.coord, jEntry.coord],
                    [startEntry.coord, endEntry.coord]
                  );
                  if (intersection !== undefined) {
                    const index = this.entries.length;
                    const point = new PointEntry(intersection);
                    point.addPath(i, -iEntry.shiftPath(j, index).repeat);
                    point.addPath(j, -jEntry.shiftPath(i, index).repeat);
                    this.entries.push(point);
                    segment.push({
                      index,
                      sqrDist: sqrDist(intersection, startEntry.coord),
                    });
                    break;
                  }
                }
              }
            }
          }
        }

        for (const intermediates of newIntermediates) {
          intermediates.sort((a, b) => a.sqrDist - b.sqrDist);
          forEachPair(intermediates.values(), (prev, current) => {
            this.entries[prev.index]!.addPath(current.index, 1);
            this.entries[current.index]!.addPath(prev.index, -1);
          });
        }
      }
    }
  }

  addPath(path: Point[]) {
    forEachPair(
      path.map((point) => this.addPoint(point)).values(),
      (prev, current) => {
        this.addEdge(prev, current);
      },
      true
    );
  }

  computeDirections() {
    for (const entry of this.entries.values()) {
      for (const [to, path] of entry.conns.entries()) {
        path.direction = direction([entry.coord, this.entries[to]!.coord]);
      }
      entry.sortConns();
    }
  }
}
