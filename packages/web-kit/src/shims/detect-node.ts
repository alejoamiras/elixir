// pino's browser build imports detect-node; the real module inspects `process`, which the
// polyfill makes look like Node and would route logs to a non-existent stdout.
export default false;
