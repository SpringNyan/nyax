import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import { AppModelDefinition } from "./models/app";
import {
  MergedEntityModelDefinition,
  MergedSubEntityModelDefinition,
} from "./models/entity";
import { TodoItemModelDefinition } from "./models/todoItem";
import { TodoListModelDefinition } from "./models/todoList";
import { UserModelDefinition } from "./models/user";

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

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

  it("reload", async () => {
    const nyax = createNyax({
      dependencies,
      createStore: options.createStore,
    });
    const { getState, getModel, registerModelDefinitionClasses, reload } = nyax;

    registerModelDefinitionClasses(
      AppModelDefinition,
      UserModelDefinition,
      TodoListModelDefinition,
      TodoItemModelDefinition,
      MergedEntityModelDefinition,
      MergedSubEntityModelDefinition
    );
    const initialRootState: any = clone(getState());

    const appModel = getModel(AppModelDefinition);
    const userModel = getModel(UserModelDefinition);
    const todoListModel = getModel(TodoListModelDefinition);
    const mergedEntityModel = getModel(MergedEntityModelDefinition);
    const mergedSubEntityModel = getModel(MergedSubEntityModelDefinition);

    expect(appModel.isRegistered).eq(true);
    expect(userModel.isRegistered).eq(true);
    expect(todoListModel.isRegistered).eq(true);
    expect(mergedEntityModel.isRegistered).eq(true);
    expect(mergedSubEntityModel.isRegistered).eq(true);
    expect(getModel(TodoItemModelDefinition, "1").isRegistered).eq(false);
    expect(getModel(TodoItemModelDefinition, "2").isRegistered).eq(false);
    expect(getModel(TodoItemModelDefinition, "3").isRegistered).eq(false);

    await appModel.actions.initialize({});

    userModel.unregister();

    await todoListModel.actions.add({ title: "123", description: "321" });
    await todoListModel.actions.add({ title: "456", description: "654" });
    await getModel(TodoItemModelDefinition, "1").actions.setIsDone(true);

    await mergedEntityModel.actions.setFooBarBaz({
      foo: "F",
      bar: "B",
      baz: "B",
    });

    await mergedSubEntityModel.actions.foo.setFooUpper("o_o");

    const snapshotRootState: any = clone(getState());
    expect(snapshotRootState).not.deep.eq(initialRootState);

    // When calling `reload` without state, only reload registered static models at that time.
    reload();
    const expectedInitialRootState = { ...initialRootState };
    delete expectedInitialRootState["user"];
    expect(clone(getState())).deep.eq(expectedInitialRootState);
    expect(userModel.isRegistered).eq(false);

    expect(appModel.isRegistered).eq(true);
    expect(todoListModel.isRegistered).eq(true);
    expect(mergedEntityModel.isRegistered).eq(true);
    expect(mergedSubEntityModel.isRegistered).eq(true);
    expect(getModel(TodoItemModelDefinition, "1").isRegistered).eq(false);
    expect(getModel(TodoItemModelDefinition, "2").isRegistered).eq(false);
    expect(getModel(TodoItemModelDefinition, "3").isRegistered).eq(false);

    reload(snapshotRootState);
    expect(clone(getState())).deep.eq(snapshotRootState);
    expect(appModel.isRegistered).eq(true);
    expect(userModel.isRegistered).eq(false);
    expect(todoListModel.isRegistered).eq(true);
    expect(mergedEntityModel.isRegistered).eq(true);
    expect(mergedSubEntityModel.isRegistered).eq(true);
    expect(getModel(TodoItemModelDefinition, "1").isRegistered).eq(true);
    expect(getModel(TodoItemModelDefinition, "2").isRegistered).eq(true);
    expect(getModel(TodoItemModelDefinition, "3").isRegistered).eq(false);
  });
}
