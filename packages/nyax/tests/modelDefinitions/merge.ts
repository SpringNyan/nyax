import {
  createModelDefinition,
  extendModelDefinition,
  mergeModelDefinitions,
} from "../../src";
import { baseModelDef } from "./_base";

const strsModelDef = createModelDefinition({
  state() {
    return {
      strs: ["n", "y", "a", "n"],
    };
  },
  selectors: {
    str() {
      return this.createSelector(
        () => this.state.strs,
        (strs) => strs.join("")
      );
    },
  },
  reducers: {
    reverseStrs() {
      this.state.strs.reverse();
    },
  },
  effects: {
    fromStr(str: string) {
      this.patch({
        strs: str.split(""),
      });
    },
  },
});

export const mergeModelDef = createModelDefinition(
  "merge",
  extendModelDefinition(
    baseModelDef,
    mergeModelDefinitions([
      createModelDefinition({
        state() {
          return {
            a: "a",
            foo: {
              bar: "foo_bar",
            },
          };
        },
      }),
      createModelDefinition({
        state() {
          return {
            b: "b",
            foo: {
              baz: "foo_baz",
            },
          };
        },
      }),
      createModelDefinition({
        state() {
          return {
            c: "c",
            bar: {
              baz: "bar_baz",
            },
          };
        },
      }),
      mergeModelDefinitions({
        foo: createModelDefinition({
          state() {
            return {
              abc: "foo_abc",
              xyz: {
                foo: "foo_xyz_foo",
              },
            };
          },
        }),
        strs1: strsModelDef,
        strs2: strsModelDef,
      }),
      strsModelDef,
    ])
  )
);
