import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import { TodoItemModel } from "./models/todoItem";
import { TodoListModel } from "./models/todoList";
import { waitTime } from "./utils";

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

  it("dynamic", async () => {
    const nyax = createNyax({
      dependencies,
      createStore: options.createStore,
    });
    const { getContainer, getState } = nyax;

    const todoListContainer = getContainer(TodoListModel);

    expect(todoListContainer).eq(getContainer("todo.list"));
    expect(todoListContainer.namespace).eq("todo.list");
    expect(todoListContainer.key).eq(undefined);

    expect(todoListContainer.isRegistered).eq(false);
    expect(todoListContainer.state.nextId).eq(1);
    expect(todoListContainer.state.ids).deep.eq([]);
    expect(todoListContainer.getters.items).deep.eq([]);

    await todoListContainer.actions.add({
      title: "TODO 1",
      description: "nyan",
    });

    expect(todoListContainer.isRegistered).eq(true);
    expect(todoListContainer.state.nextId).eq(2);
    expect(todoListContainer.state.ids).deep.eq(["1"]);
    expect(todoListContainer.getters.items).deep.eq([
      {
        title: "TODO 1",
        description: "nyan",
        isDone: false,
      },
    ]);

    const todoItem1Container = getContainer(TodoItemModel, "1");
    expect(todoItem1Container.isRegistered).eq(true);
    expect(todoItem1Container.state).eq(getState(TodoItemModel)?.["1"]);
    expect(todoItem1Container.state).eq(getState(TodoItemModel, "1"));
    expect(todoItem1Container.getters.id).eq("1");
    expect(todoItem1Container.getters.summary).eq("TODO 1: nyan");
    todoItem1Container.actions.setIsDone(true);
    expect(todoItem1Container.getters.summary).eq("[DONE] TODO 1: nyan");

    const todoItem2Container = getContainer(TodoItemModel, "2");
    expect(todoItem2Container.isRegistered).eq(false);

    todoItem2Container.register();
    expect(todoItem2Container.isRegistered).eq(true);
    todoItem2Container.actions.setTitle("TODO 2");
    todoItem2Container.actions.setDescription("meow");
    expect(todoItem2Container.getters.summary).eq("TODO 2: meow");
    expect(todoItem2Container.state).eq(getState(TodoItemModel)?.["2"]);
    expect(todoItem1Container.getters.summary).eq("[DONE] TODO 1: nyan");

    todoItem1Container.actions.setIsDone(false);
    expect(todoItem1Container.state.isDone).eq(false);
    expect(todoItem2Container.state.isDone).eq(false);
    todoListContainer.actions.requestAllDone({});
    await waitTime(10);
    expect(todoItem1Container.state.isDone).eq(true);
    expect(todoItem2Container.state.isDone).eq(true);

    todoItem2Container.unregister();
    expect(todoItem2Container.isRegistered).eq(false);
    expect(todoItem2Container.getters.summary).eq(": ");
    expect(todoItem1Container.getters.summary).eq("[DONE] TODO 1: nyan");
    expect(getState(TodoItemModel)?.["2"]).eq(undefined);

    todoItem1Container.actions.setIsDone(false);
    expect(todoItem1Container.state.isDone).eq(false);
    expect(todoItem2Container.state.isDone).eq(false);
    todoListContainer.actions.requestAllDone({});
    await waitTime(10);
    expect(todoItem1Container.state.isDone).eq(true);
    expect(todoItem2Container.state.isDone).eq(false);

    await todoListContainer.actions.add({
      title: "todo 2",
      description: "zzzz",
    });
    expect(todoItem2Container.isRegistered).eq(true);
    expect(todoItem2Container.getters.summary).eq("todo 2: zzzz");
    expect(todoListContainer.state.ids).deep.eq(["1", "2"]);
    expect(todoListContainer.getters.items).deep.eq([
      {
        title: "TODO 1",
        description: "nyan",
        isDone: true,
      },
      {
        title: "todo 2",
        description: "zzzz",
        isDone: false,
      },
    ]);
  });
}
