import { expect } from "chai";
import { createNyax, NyaxOptions } from "../src";
import { mergeModelDef } from "./modelDefinitions/merge";

function test(options?: { title?: string; nyaxOptions?: NyaxOptions }): void {
  const { title = "default", nyaxOptions } = options ?? {};

  it(title, async () => {
    const nyax = createNyax(nyaxOptions);
    const { getModel } = nyax;

    const mergeModel = getModel(mergeModelDef);
    expect(mergeModel.state).deep.eq({
      a: "a",
      b: "b",
      c: "c",
      foo: {
        bar: "foo_bar",
        baz: "foo_baz",
        abc: "foo_abc",
        xyz: {
          foo: "foo_xyz_foo",
        },
      },
      bar: {
        baz: "bar_baz",
      },
      strs: ["n", "y", "a", "n"],
      strs1: {
        strs: ["n", "y", "a", "n"],
      },
      strs2: {
        strs: ["n", "y", "a", "n"],
      },
    });

    mergeModel.actions.reverseStrs({});
    expect(mergeModel.state.strs).deep.eq(["n", "a", "y", "n"]);
    expect(mergeModel.state.strs1.strs).deep.eq(["n", "y", "a", "n"]);
    expect(mergeModel.state.strs2.strs).deep.eq(["n", "y", "a", "n"]);

    mergeModel.actions.strs1.fromStr("meow");
    expect(mergeModel.state.strs).deep.eq(["n", "a", "y", "n"]);
    expect(mergeModel.state.strs1.strs).deep.eq(["m", "e", "o", "w"]);
    expect(mergeModel.state.strs2.strs).deep.eq(["n", "y", "a", "n"]);

    const mergeStr2Model = mergeModel.getSubModel("strs2");
    mergeStr2Model.set({
      strs: ["a", "b", "c", "d"],
    });
    expect(mergeModel.state.strs).deep.eq(["n", "a", "y", "n"]);
    expect(mergeModel.state.strs1.strs).deep.eq(["m", "e", "o", "w"]);
    expect(mergeModel.state.strs2.strs).deep.eq(["a", "b", "c", "d"]);
    mergeStr2Model.actions.reverseStrs({});
    expect(mergeModel.state.strs).deep.eq(["n", "a", "y", "n"]);
    expect(mergeModel.state.strs1.strs).deep.eq(["m", "e", "o", "w"]);
    expect(mergeModel.state.strs2.strs).deep.eq(["d", "c", "b", "a"]);

    mergeModel.patch((state) => ({
      a: "x",
      b: "y",
      foo: {
        ...state.foo,
        bar: "bar_foo",
      },
    }));
    expect(mergeModel.state.a).eq("x");
    expect(mergeModel.state.b).eq("y");
    expect(mergeModel.state.c).eq("c");
    expect(mergeModel.state.foo.bar).eq("bar_foo");
    expect(mergeModel.state.foo.baz).eq("foo_baz");
  });
}

describe("merge", function () {
  test();
  test({
    title: "options",
    nyaxOptions: {
      namespaceSeparator: ".",
      pathSeparator: "/",
    },
  });
});
