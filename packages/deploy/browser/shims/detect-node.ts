// The process polyfill makes `detect-node` believe it runs under Node, which sends pino to its
// worker-thread transport; pinning it to false keeps the browser transport (same fix as nulo).
export default false;
