import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import {
  MergedEntityModelDefinition,
  MergedSubEntityModelDefinition,
} from "./models/entity";

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
    const { getModel, registerModelDefinitionClasses } = nyax;

    registerModelDefinitionClasses(
      MergedEntityModelDefinition,
      MergedSubEntityModelDefinition
    );

    const mergedEntityModel = getModel(MergedEntityModelDefinition);
    const mergedSubEntityModel = getModel(MergedSubEntityModelDefinition);

    expect(mergedEntityModel.isRegistered).eq(true);

    expect(mergedEntityModel.state.foo).eq("foo");
    expect(mergedEntityModel.state.bar).eq("bar");
    expect(mergedEntityModel.state.baz).eq("baz");
    expect(mergedEntityModel.state.fooChangeTimes).eq(0);

    await mergedEntityModel.actions.setFooUpper("abc");
    expect(mergedEntityModel.state.foo).eq("ABC");
    expect(mergedEntityModel.getters.foo$foo).eq("ABC$ABC");
    expect(mergedEntityModel.state.fooChangeTimes).eq(1);

    await mergedEntityModel.actions.setBarLower("Orz");
    expect(mergedEntityModel.state.bar).eq("orz");
    expect(mergedEntityModel.getters.bar_bar).eq("orz_orz");
    expect(mergedEntityModel.state.fooChangeTimes).eq(1);

    await mergedEntityModel.actions.setFooBarBaz({
      foo: "oof",
      bar: "rab",
      baz: "zab",
    });
    expect(mergedEntityModel.getters.fooBarBaz).eq("oofrabzab");
    expect(mergedEntityModel.state.fooChangeTimes).eq(2);

    expect(mergedSubEntityModel.isRegistered).eq(true);

    expect(mergedSubEntityModel.state.foo.foo).eq("foo");
    expect(mergedSubEntityModel.state.bar.bar).eq("bar");
    expect(mergedSubEntityModel.state.baz.baz).eq("baz");
    expect(mergedSubEntityModel.state.barChangeTimes).eq(2);

    await mergedSubEntityModel.actions.baz.setBazTrim(" xyz ");
    expect(mergedSubEntityModel.state.baz.baz).eq("xyz");
    expect(mergedSubEntityModel.getters.baz.baz0baz).eq("xyz0xyz");
    expect(mergedSubEntityModel.state.barChangeTimes).eq(2);

    await mergedSubEntityModel.actions.bar.setBarLower("NYAN");
    expect(mergedSubEntityModel.state.bar.bar).eq("nyan");
    expect(mergedSubEntityModel.getters.bar.bar_bar).eq("nyan_nyan");
    expect(mergedSubEntityModel.state.barChangeTimes).eq(3);

    await mergedSubEntityModel.actions.setFooBarBaz({
      foo: "FOO",
      bar: "BAR",
      baz: "BAZ",
    });
    expect(mergedSubEntityModel.getters.fooBarBaz).eq("FOOBARBAZ");
    expect(mergedSubEntityModel.state.barChangeTimes).eq(4);
  });
}
