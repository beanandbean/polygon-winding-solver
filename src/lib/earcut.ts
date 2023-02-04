import { EdgeIndex, LoopTriangulator, TriangulatorType } from "./triangulate";
import { area, dot, isZero, HitTestTriangle, Point, Triangle } from "./utils";

class DoublyLinkedNode<T> {
  data: T;
  prev = -1;
  next = -1;

  constructor(data: T) {
    this.data = data;
  }
}

const pushSequence = <T>(
  list: Array<DoublyLinkedNode<T>>,
  sequence: Array<T>
): EdgeIndex => {
  const startIndex = list.length;
  for (const [i, data] of sequence.entries()) {
    const node = new DoublyLinkedNode(data);
    if (i > 0) {
      node.prev = startIndex + i - 1;
    }
    if (i < sequence.length - 1) {
      node.next = startIndex + i + 1;
    }
    list.push(node);
  }
  return [startIndex, list.length - 1];
};

const join = <T>(
  list: Array<DoublyLinkedNode<T>>,
  first: number,
  second: number
) => {
  list[first]!.next = second;
  list[second]!.prev = first;
};

const remove = <T>(
  list: Array<DoublyLinkedNode<T>>,
  node: DoublyLinkedNode<T>
) => {
  join(list, node.prev, node.next);
};

const moveToBefore = <T>(
  list: Array<DoublyLinkedNode<T>>,
  source: number,
  dest: number
) => {
  remove(list, list[source]!);
  join(list, list[dest]!.prev, source);
  join(list, source, dest);
};

// this implementation of earcut triangulation is a simplified version of 'github.com/mapbox/earcut'

export default class EarcutTriangulator implements LoopTriangulator {
  readonly type = TriangulatorType.loop;

  triangulate(points: Point[], loop: number[]) {
    const loopNodes = new Array<DoublyLinkedNode<number>>();
    const [start, end] = pushSequence(loopNodes, loop);
    join(loopNodes, end, start);

    const actions = new Array<DoublyLinkedNode<undefined>>();
    pushSequence(actions, new Array<undefined>(loop.length).fill(undefined));

    const ACTION_CUT = loop.length;
    const ACTION_NONE = ACTION_CUT + 1;
    pushSequence(actions, new Array<undefined>(2).fill(undefined));
    join(actions, ACTION_NONE, ACTION_CUT);
    join(actions, ACTION_CUT, start);
    join(actions, end, ACTION_NONE);

    const trigs = new Array<Triangle>();
    while (actions[ACTION_CUT]!.next !== ACTION_NONE) {
      const node = actions[ACTION_CUT]!.next;
      if (loopNodes[node]!.next === node) {
        break;
      } else {
        const nodeEntry = loopNodes[node]!;
        const prevPoint = loopNodes[nodeEntry.prev]!.data;
        const currentPoint = nodeEntry.data;
        const nextPoint = loopNodes[nodeEntry.next]!.data;
        const a = area(
          points[prevPoint]!,
          points[currentPoint]!,
          points[nextPoint]!
        );
        let cut = false;
        if (isZero(a)) {
          if (
            dot(points[prevPoint]!, points[currentPoint]!, points[nextPoint]!) >
            0
          ) {
            // a vertex with overlapping edges: we may need to cut away a trivial triangle
            // to prevent the process from being stuck at this point.
            // however, the triangle hitting test below ensures that this will occur
            // extremely rarely on most natural shapes
            const pArea = area(
              points[loopNodes[loopNodes[nodeEntry.prev]!.prev]!.data]!,
              points[prevPoint]!,
              points[currentPoint]!
            );
            const nArea = area(
              points[currentPoint]!,
              points[nextPoint]!,
              points[loopNodes[loopNodes[nodeEntry.next]!.next]!.data]!
            );
            cut = pArea > 0 && nArea > 0;
          }
        } else if (a < 0) {
          const triangle: Triangle = [
            points[prevPoint]!,
            points[currentPoint]!,
            points[nextPoint]!,
          ];
          const testTriangle = new HitTestTriangle(triangle);
          cut = true;
          let current = nodeEntry.next;
          // if code reaches here, remaining loop has at least 3 nodes
          while (loopNodes[current]!.next !== nodeEntry.prev) {
            current = loopNodes[current]!.next;
            const point = loopNodes[current]!.data;
            if (
              point !== prevPoint &&
              point !== currentPoint &&
              point !== nextPoint &&
              testTriangle.contains(points[point]!)
            ) {
              cut = false;
            }
          }

          if (cut) {
            trigs.push(triangle);
            remove(loopNodes, nodeEntry);

            moveToBefore(actions, nodeEntry.prev, ACTION_NONE); // before `ACTION_NONE` means after `ACTION_CUT`
            if (nodeEntry.next !== nodeEntry.prev) {
              moveToBefore(actions, nodeEntry.next, ACTION_NONE); // before `ACTION_NONE` means after `ACTION_CUT`
            }
          }
        }
        moveToBefore(actions, node, ACTION_CUT); // before `ACTION_CLEAN` means after `ACTION_NONE`
      }
    }

    return trigs;
  }
}
