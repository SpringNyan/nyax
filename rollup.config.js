import typescript from "@rollup/plugin-typescript";
import cleanup from "rollup-plugin-cleanup";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/nyax.js",
      format: "cjs",
    },
    {
      file: "dist/nyax.esm.js",
      format: "esm",
    },
  ],
  plugins: [
    typescript(),
    cleanup({
      comments: "none",
    }),
  ],
  external: ["immer", "redux", "redux-observable", "rxjs", "rxjs/operators"],
};
