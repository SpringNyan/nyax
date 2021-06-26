import { expect } from "chai";
import { createNyax, CreateStore, createSubContainer } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import { MergedEntityModel, MergedSubEntityModel } from "./models/entity";

export function test(options: {
  packageName: string;
  createStore: CreateStore;
  createSelector?: CreateSelector;
}): void {
  const dependencies: Dependencies = {
    packageName: options.packageName,
  };
  testDependencies.createSelector =
    options.createSelector ?? defaultCreateSelector;

  it("merge", async () => {
    const nyax = createNyax({
      dependencies,
      createStore: options.createStore,
    });
    const { getContainer, registerModelClasses } = nyax;

    registerModelClasses(MergedEntityModel, MergedSubEntityModel);

    const mergedEntityContainer = getContainer(MergedEntityModel);
    const mergedSubEntityContainer = getContainer(MergedSubEntityModel);

    expect(mergedEntityContainer.isRegistered).eq(true);

    expect(mergedEntityContainer.state.foo).eq("foo");
    expect(mergedEntityContainer.state.bar).eq("bar");
    expect(mergedEntityContainer.state.baz).eq("baz");
    expect(mergedEntityContainer.state.fooChangeTimes).eq(0);

    await mergedEntityContainer.actions.setFooUpper("abc");
    expect(mergedEntityContainer.state.foo).eq("ABC");
    expect(mergedEntityContainer.getters.foo$foo).eq("ABC$ABC");
    expect(mergedEntityContainer.state.fooChangeTimes).eq(1);

    await mergedEntityContainer.actions.setBarLower("Orz");
    expect(mergedEntityContainer.state.bar).eq("orz");
    expect(mergedEntityContainer.getters.bar_bar).eq("orz_orz");
    expect(mergedEntityContainer.state.fooChangeTimes).eq(1);

    await mergedEntityContainer.actions.setFooBarBaz({
      foo: "oof",
      bar: "rab",
      baz: "zab",
    });
    expect(mergedEntityContainer.getters.fooBarBaz).eq("oofrabzab");
    expect(mergedEntityContainer.state.fooChangeTimes).eq(2);

    expect(mergedSubEntityContainer.isRegistered).eq(true);

    expect(mergedSubEntityContainer.state.foo.foo).eq("foo");
    expect(mergedSubEntityContainer.state.bar.bar).eq("bar");
    expect(mergedSubEntityContainer.state.baz.baz).eq("baz");
    expect(mergedSubEntityContainer.state.barChangeTimes).eq(2);

    await mergedSubEntityContainer.actions.baz.setBazTrim(" xyz ");
    expect(mergedSubEntityContainer.state.baz.baz).eq("xyz");
    expect(mergedSubEntityContainer.getters.baz.baz0baz).eq("xyz0xyz");
    expect(mergedSubEntityContainer.state.barChangeTimes).eq(2);

    await mergedSubEntityContainer.actions.bar.setBarLower("NYAN");
    expect(mergedSubEntityContainer.state.bar.bar).eq("nyan");
    expect(mergedSubEntityContainer.getters.bar.bar_bar).eq("nyan_nyan");
    expect(mergedSubEntityContainer.state.barChangeTimes).eq(3);

    await mergedSubEntityContainer.actions.setFooBarBaz({
      foo: "FOO",
      bar: "BAR",
      baz: "BAZ",
    });
    expect(mergedSubEntityContainer.getters.fooBarBaz).eq("FOOBARBAZ");
    expect(mergedSubEntityContainer.state.barChangeTimes).eq(4);

    const bazContainer = createSubContainer(mergedSubEntityContainer, "baz");
    expect(bazContainer.state.baz).eq(mergedSubEntityContainer.state.baz.baz);
    expect(bazContainer.getters.baz0baz).eq(
      mergedSubEntityContainer.getters.baz.baz0baz
    );
    await bazContainer.actions.setBazTrim.dispatch("  Orz  ");
    expect(bazContainer.getters.baz0baz).eq("Orz0Orz");
    expect(mergedSubEntityContainer.getters.fooBarBaz).eq("FOOBAROrz");
  });
}
