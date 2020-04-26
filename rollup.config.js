import typescript from "@rollup/plugin-typescript";
import cleanup from "rollup-plugin-cleanup";
import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "cjs",
    },
    {
      file: pkg.module,
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
