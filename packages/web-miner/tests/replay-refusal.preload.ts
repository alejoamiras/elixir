// Loaded with `bun --preload` by the refusal test: were `serve` to reach the preview helpers, the
// sentinel fires instead of a port being claimed or a build started.
Bun.plugin({
  name: 'replay-refusal-sentinel',
  setup(build) {
    build.onLoad({ filter: /scripts\/run\/preview\.ts$/ }, () => ({
      loader: 'ts',
      contents: `
        const reached = () => { throw new Error('PREVIEW_REACHED'); };
        export const claimPreviewPort = reached;
        export const buildApp = reached;
        export const startPreview = reached;
        export const waitUntilUp = reached;
      `,
    }));
  },
});
