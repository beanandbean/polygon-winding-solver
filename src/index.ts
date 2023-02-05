export * from "./triangulate";
export { default } from "./triangulate";

export { Edge, Point, Triangle } from "./utils";

// tsc emits emulated ES-modules by default;
// this snippet makes it a standard commonjs module
// for commonjs and native ESM interop.
// we could do this for every module but
// for now this is only applied to `index.ts`
Object.defineProperties(
  exports.default,
  Object.getOwnPropertyDescriptors(exports)
);
exports = module.exports = exports.default;
