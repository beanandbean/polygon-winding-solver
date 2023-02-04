import {
  contains,
  direction,
  edgeBox,
  equals,
  forEachPair,
  intersect,
  sqrDist,
  Edge,
  Point,
} from "./utils";

export class PathEntry {
  repeat: number;

  // `ignore` means path is added by system and only used for joining disjoint sections;
  // assume all ignored paths are added after all user paths, so never need to change
  // this from true to false
  ignore: boolean;

  // direction will only be computed
  // after all intersections are processed
  direction = 0;

  loop = -1;

  // the following parameters are used by graph simplifier;
  // only paths that are clockwise around the interior are called boundaries
  isBoundary = false;
  inSimplified = false;
  loopVisited = false;

  constructor(repeat: number, ignore: boolean = false) {
    this.repeat = repeat;
    this.ignore = ignore;
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

  // assumes all directions are computed
  sortConns() {
    const dirs = Array.from(this.conns.entries());
    dirs.sort((a, b) => b[1].direction - a[1].direction);
    this.directions = dirs.map((path) => path[0]);
  }

  // methods below are low-level
  // they do not attempt to sync the opposite path entry

  addPath(to: number, repeat: number, ignore: boolean = false) {
    this.conns.set(to, new PathEntry(repeat, ignore));
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

  pathConnections = new Array<number>();

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

  private addEdge(start: number, end: number, ignore: boolean = false) {
    type PointWithDistance = {
      index: number;
      sqrDist: number;
    };

    if (start != end) {
      const winding = ignore ? 0 : 1;
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
          prevEntry.conns.get(current.index)!.repeat += winding;
          currentEntry.conns.get(prev.index)!.repeat -= winding;
        } else {
          const sqrd = sqrDist(currentEntry.coord, prevEntry.coord);
          newIntermediates.push([
            { index: prev.index, sqrDist: 0 },
            { index: current.index, sqrDist: sqrd },
          ]);
        }
      });

      if (newIntermediates.length > 0) {
        const edges = newIntermediates.map((segment) => {
          const edge: Edge = [
            this.entries[segment[0]!.index]!.coord,
            this.entries[segment[1]!.index]!.coord,
          ];
          return {
            edge,
            box: edgeBox(edge),
          };
        });

        // third step: find intersections with existing edges
        for (const [i, iChecked] of checked.entries()) {
          if (!iChecked) {
            const iEntry = this.entries[i]!;
            for (const j of iEntry.conns.keys()) {
              if (j > i && j < checked.length && !checked[j]) {
                const jEntry = this.entries[j]!;
                const incident: Edge = [iEntry.coord, jEntry.coord];
                const incidentBox = edgeBox(incident);
                for (const [segIndex, segment] of newIntermediates.entries()) {
                  const edgeData = edges[segIndex]!;
                  if (
                    incidentBox[0].x < edgeData.box[1].x &&
                    incidentBox[1].x > edgeData.box[0].x &&
                    incidentBox[0].y < edgeData.box[1].y &&
                    incidentBox[1].y > edgeData.box[0].y
                  ) {
                    const intersection = intersect(incident, edgeData.edge);
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
        }

        for (const intermediates of newIntermediates) {
          intermediates.sort((a, b) => a.sqrDist - b.sqrDist);
          forEachPair(intermediates.values(), (prev, current) => {
            this.entries[prev.index]!.addPath(current.index, winding, ignore);
            this.entries[current.index]!.addPath(prev.index, -winding, ignore);
          });
        }
      }
    }
  }

  addPath(path: Point[]) {
    const points = path.map((point) => this.addPoint(point));
    if (points.length > 0) {
      this.pathConnections.push(points[points.length - 1]!);
    }

    forEachPair(
      points.values(),
      (prev, current) => {
        this.addEdge(prev, current);
      },
      true
    );
  }

  // called after all user paths are added to join disjoint sections
  connectPaths() {
    forEachPair(this.pathConnections.values(), (prev, current) => {
      this.addEdge(prev, current, true);
    });
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
