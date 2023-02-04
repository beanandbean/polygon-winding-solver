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

export const direction = (edge: Edge) =>
  Math.atan2(edge[1].y - edge[0].y, edge[1].x - edge[0].x);

export const contains = (edge: Edge, target: Point) =>
  isZero(area(edge[0], target, edge[1])) && dot(edge[0], target, edge[1]) < 0;

export const horizontalHit = (edge: Edge, y: number) => {
  if ((edge[0].y < y && edge[1].y < y) || (edge[0].y >= y && edge[1].y >= y)) {
    return undefined;
  } else {
    let ratio = (y - edge[0].y) / (edge[1].y - edge[0].y);
    if (ratio < 0) {
      ratio = 0;
    } else if (ratio > 1) {
      ratio = 1;
    }
    return edge[0].x + ratio * (edge[1].x - edge[0].x);
  }
};

export const leftRayTest = (edge: Edge, source: Point) => {
  const hit = horizontalHit(edge, source.y);
  if (hit === undefined) {
    return false;
  } else {
    return hit + THRESHOLD < source.x;
  }
};

export const loopContains = (loop: Point[], target: Point) => {
  let count = 0;
  forEachPair(
    loop.values(),
    (prev, current) => {
      count += leftRayTest([prev, current], target) ? 1 : 0;
    },
    true
  );
  return count % 2 === 1;
};

// assumes four points are distinct, intersection not on ends,
// and do not treat overlap situations.
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
