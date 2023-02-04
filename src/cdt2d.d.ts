declare module "cdt2d" {
  const cdt2d: (
    points: [number, number][],
    edges: [number, number][],
    options: {
      delaunay?: boolean;
      interior?: boolean;
      exterior?: boolean;
      infinity?: boolean;
    }
  ) => [number, number, number][];
  export = cdt2d;
}
