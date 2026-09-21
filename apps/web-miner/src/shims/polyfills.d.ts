// The shim packages ship no typings; only their existence matters to the Worker global setup.
declare module 'vite-plugin-node-polyfills/shims/buffer' {
  const Buffer: unknown;

  export { Buffer };
}
declare module 'vite-plugin-node-polyfills/shims/process' {
  const process: unknown;

  export { process };
}
