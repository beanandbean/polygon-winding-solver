export const forEachPair = <T>(
  iter: IterableIterator<T>,
  action: (a: T, b: T) => void,
  loopOver: boolean = false
) => {
  const first = iter.next();
  if (!first.done) {
    const start = first.value;
    let prev = start;
    for (const current of iter) {
      action(prev, current);
      prev = current;
    }
    if (loopOver) {
      action(prev, start);
    }
  }
};

// below are primitive operations in computational geometry

const THRESHOLD = 1e-8;

export type Point = { x: number; y: number };
export type Edge = [Point, Point];
export type Triangle = [Point, Point, Point];

export const isZero = (x: number) => x > -THRESHOLD && x < THRESHOLD;
export const equals = (p: Point, q: Point) =>
  isZero(p.x - q.x) && isZero(p.y - q.y);

export const sqrDist = (p: Point, q: Point) =>
  Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2);

// dot product between (a - b) and (c - b)
export const dot = (a: Point, b: Point, c: Point) =>
  (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);

// cross product between (a - b) and (c - b)
export const area = (a: Point, b: Point, c: Point) =>
  (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x);

export const edgeBox = (edge: Edge): [Point, Point] => {
  const x0 = edge[0].x < edge[1].x ? edge[0].x : edge[1].x;
  const x1 = edge[0].x > edge[1].x ? edge[0].x : edge[1].x;
  const y0 = edge[0].y < edge[1].y ? edge[0].y : edge[1].y;
  const y1 = edge[0].y > edge[1].y ? edge[0].y : edge[1].y;
  return [
    { x: x0 - THRESHOLD, y: y0 - THRESHOLD },
    { x: x1 + THRESHOLD, y: y1 + THRESHOLD },
  ];
};

export const direction = (edge: Edge) =>
  Math.atan2(edge[1].y - edge[0].y, edge[1].x - edge[0].x);

export const contains = (edge: Edge, target: Point) =>
  isZero(area(edge[0], target, edge[1])) && dot(edge[0], target, edge[1]) < 0;

// assumes four points are distinct, intersection not on ends, and do not treat overlap situations.
// thus it suffices to compute matrix inverse
export const intersect = (edge: Edge, other: Edge): Point | undefined => {
  const a = edge[1].x - edge[0].x;
  const b = other[0].x - other[1].x;
  const c = edge[1].y - edge[0].y;
  const d = other[0].y - other[1].y;
  const p1 = other[0].x - edge[0].x;
  const p2 = other[0].y - edge[0].y;
  const det = a * d - b * c;
  if (isZero(det)) {
    return undefined;
  } else {
    const dinv = 1 / det;
    const t1 = dinv * (d * p1 - b * p2);
    const t2 = dinv * (a * p2 - c * p1);
    if (t1 > 0 && t1 < 1 && t2 > 0 && t2 < 1) {
      return { x: edge[0].x + a * t1, y: edge[0].y + c * t1 };
    } else {
      return undefined;
    }
  }
};

export const triangleBox = (trig: Triangle): [Point, Point] => {
  const x0 =
    trig[0].x < trig[1].x
      ? trig[0].x < trig[2].x
        ? trig[0].x
        : trig[2].x
      : trig[1].x < trig[2].x
      ? trig[1].x
      : trig[2].x;
  const x1 =
    trig[0].x > trig[1].x
      ? trig[0].x > trig[2].x
        ? trig[0].x
        : trig[2].x
      : trig[1].x > trig[2].x
      ? trig[1].x
      : trig[2].x;
  const y0 =
    trig[0].y < trig[1].y
      ? trig[0].y < trig[2].y
        ? trig[0].y
        : trig[2].y
      : trig[1].y < trig[2].y
      ? trig[1].y
      : trig[2].y;
  const y1 =
    trig[0].y > trig[1].y
      ? trig[0].y > trig[2].y
        ? trig[0].y
        : trig[2].y
      : trig[1].y > trig[2].y
      ? trig[1].y
      : trig[2].y;
  return [
    { x: x0 - THRESHOLD, y: y0 - THRESHOLD },
    { x: x1 + THRESHOLD, y: y1 + THRESHOLD },
  ];
};

// barycentric triangle hit-testing, with origin at `trig[1]`
// points precisely on the edges are also counted as hits
export class HitTestTriangle {
  origin: Point;
  p1: Point;
  p2: Point;

  box: [Point, Point];
  det: number; // `det === 0` means no triangle

  constructor(trig: Triangle) {
    this.origin = trig[1];
    this.p1 = { x: trig[0].x - trig[1].x, y: trig[0].y - trig[1].y };
    this.p2 = { x: trig[2].x - trig[1].x, y: trig[2].y - trig[1].y };
    this.box = triangleBox(trig);

    this.det = this.p1.x * this.p2.y - this.p1.y * this.p2.x;
    if (!isZero(this.det)) {
      if (this.det > 0) {
        this.det += THRESHOLD;
      } else {
        this.det -= THRESHOLD;
      }
    }
  }

  // no safety checking; output unreliable if `this.det === 0`
  contains(point: Point) {
    if (
      point.x > this.box[0].x &&
      point.x < this.box[1].x &&
      point.y > this.box[0].y &&
      point.y < this.box[1].y
    ) {
      const x = point.x - this.origin.x;
      const y = point.y - this.origin.y;
      const u = this.p2.y * x - this.p2.x * y;
      const v = this.p1.x * y - this.p1.y * x;
      if (this.det > 0) {
        return u > -THRESHOLD && v > -THRESHOLD && u + v < this.det;
      } else {
        return u < THRESHOLD && v < THRESHOLD && u + v > this.det;
      }
    } else {
      return false;
    }
  }
}
