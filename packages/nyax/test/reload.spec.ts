import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import { AppModel } from "./models/app";
import { MergedEntityModel, MergedSubEntityModel } from "./models/entity";
import { TodoItemModel } from "./models/todoItem";
import { TodoListModel } from "./models/todoList";
import { UserModel } from "./models/user";

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
    const { getState, getContainer, registerModelClasses, reload } = nyax;

    registerModelClasses(
      AppModel,
      UserModel,
      TodoListModel,
      TodoItemModel,
      MergedEntityModel,
      MergedSubEntityModel
    );
    const initialRootState: any = clone(getState());

    const appContainer = getContainer(AppModel);
    const userContainer = getContainer(UserModel);
    const todoListContainer = getContainer(TodoListModel);
    const mergedEntityContainer = getContainer(MergedEntityModel);
    const mergedSubEntityContainer = getContainer(MergedSubEntityModel);

    expect(appContainer.isRegistered).eq(true);
    expect(userContainer.isRegistered).eq(true);
    expect(todoListContainer.isRegistered).eq(true);
    expect(mergedEntityContainer.isRegistered).eq(true);
    expect(mergedSubEntityContainer.isRegistered).eq(true);
    expect(getContainer(TodoItemModel, "1").isRegistered).eq(false);
    expect(getContainer(TodoItemModel, "2").isRegistered).eq(false);
    expect(getContainer(TodoItemModel, "3").isRegistered).eq(false);

    await appContainer.actions.initialize({});

    userContainer.unregister();

    await todoListContainer.actions.add({ title: "123", description: "321" });
    await todoListContainer.actions.add({ title: "456", description: "654" });
    await getContainer(TodoItemModel, "1").actions.setIsDone(true);

    await mergedEntityContainer.actions.setFooBarBaz({
      foo: "F",
      bar: "B",
      baz: "B",
    });

    await mergedSubEntityContainer.actions.foo.setFooUpper("o_o");

    const snapshotRootState: any = clone(getState());
    expect(snapshotRootState).not.deep.eq(initialRootState);

    // When calling `reload` without state, only reload registered static models at that time.
    reload();
    const expectedInitialRootState = { ...initialRootState };
    delete expectedInitialRootState["user"];
    expect(clone(getState())).deep.eq(expectedInitialRootState);
    expect(userContainer.isRegistered).eq(false);

    expect(appContainer.isRegistered).eq(true);
    expect(todoListContainer.isRegistered).eq(true);
    expect(mergedEntityContainer.isRegistered).eq(true);
    expect(mergedSubEntityContainer.isRegistered).eq(true);
    expect(getContainer(TodoItemModel, "1").isRegistered).eq(false);
    expect(getContainer(TodoItemModel, "2").isRegistered).eq(false);
    expect(getContainer(TodoItemModel, "3").isRegistered).eq(false);

    reload(snapshotRootState);
    expect(clone(getState())).deep.eq(snapshotRootState);
    expect(appContainer.isRegistered).eq(true);
    expect(userContainer.isRegistered).eq(false);
    expect(todoListContainer.isRegistered).eq(true);
    expect(mergedEntityContainer.isRegistered).eq(true);
    expect(mergedSubEntityContainer.isRegistered).eq(true);
    expect(getContainer(TodoItemModel, "1").isRegistered).eq(true);
    expect(getContainer(TodoItemModel, "2").isRegistered).eq(true);
    expect(getContainer(TodoItemModel, "3").isRegistered).eq(false);
  });
}
