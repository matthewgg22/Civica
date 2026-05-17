// @types/react 18.3 removed Component.refs from the public interface.
// @react-pdf/renderer 3.x JSX components fail TS2786 because the checker
// requires refs in the constructor signature. Restore it as a global
// ambient patch (no import — avoids cross-version type resolution in pnpm
// workspaces). Remove when upgrading to @react-pdf/renderer ^4.x.

declare namespace React {
  interface Component<P = {}, S = {}, SS = any> {
    refs: { [key: string]: any };
  }
}
