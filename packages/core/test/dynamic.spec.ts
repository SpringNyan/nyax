import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import { TodoItemModelDefinition } from "./models/todoItem";
import { TodoListModelDefinition } from "./models/todoList";
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
    const { getModel, getState } = nyax;

    const todoListModel = getModel(TodoListModelDefinition);

    expect(todoListModel).eq(getModel("todo.list"));
    expect(todoListModel.namespace).eq("todo.list");
    expect(todoListModel.key).eq(undefined);

    expect(todoListModel.isRegistered).eq(false);
    expect(todoListModel.state.nextId).eq(1);
    expect(todoListModel.state.ids).deep.eq([]);
    expect(todoListModel.getters.items).deep.eq([]);

    await todoListModel.actions.add.dispatch({
      title: "TODO 1",
      description: "nyan",
    });

    expect(todoListModel.isRegistered).eq(true);
    expect(todoListModel.state.nextId).eq(2);
    expect(todoListModel.state.ids).deep.eq(["1"]);
    expect(todoListModel.getters.items).deep.eq([
      {
        title: "TODO 1",
        description: "nyan",
        isDone: false,
      },
    ]);

    const todoItem1Model = getModel(TodoItemModelDefinition, "1");
    expect(todoItem1Model.isRegistered).eq(true);
    expect(todoItem1Model.state).eq(getState(TodoItemModelDefinition)?.["1"]);
    expect(todoItem1Model.state).eq(getState(TodoItemModelDefinition, "1"));
    expect(todoItem1Model.getters.id).eq("1");
    expect(todoItem1Model.getters.summary).eq("TODO 1: nyan");
    todoItem1Model.actions.setIsDone.dispatch(true);
    expect(todoItem1Model.getters.summary).eq("[DONE] TODO 1: nyan");

    const todoItem2Model = getModel(TodoItemModelDefinition, "2");
    expect(todoItem2Model.isRegistered).eq(false);

    todoItem2Model.register();
    expect(todoItem2Model.isRegistered).eq(true);
    todoItem2Model.actions.setTitle.dispatch("TODO 2");
    todoItem2Model.actions.setDescription.dispatch("meow");
    expect(todoItem2Model.getters.summary).eq("TODO 2: meow");
    expect(todoItem2Model.state).eq(getState(TodoItemModelDefinition)?.["2"]);
    expect(todoItem1Model.getters.summary).eq("[DONE] TODO 1: nyan");

    todoItem1Model.actions.setIsDone.dispatch(false);
    expect(todoItem1Model.state.isDone).eq(false);
    expect(todoItem2Model.state.isDone).eq(false);
    todoListModel.actions.requestAllDone.dispatch({});
    await waitTime(10);
    expect(todoItem1Model.state.isDone).eq(true);
    expect(todoItem2Model.state.isDone).eq(true);

    todoItem2Model.unregister();
    expect(todoItem2Model.isRegistered).eq(false);
    expect(todoItem2Model.getters.summary).eq(": ");
    expect(todoItem1Model.getters.summary).eq("[DONE] TODO 1: nyan");
    expect(getState(TodoItemModelDefinition)?.["2"]).eq(undefined);

    todoItem1Model.actions.setIsDone.dispatch(false);
    expect(todoItem1Model.state.isDone).eq(false);
    expect(todoItem2Model.state.isDone).eq(false);
    todoListModel.actions.requestAllDone.dispatch({});
    await waitTime(10);
    expect(todoItem1Model.state.isDone).eq(true);
    expect(todoItem2Model.state.isDone).eq(false);

    await todoListModel.actions.add.dispatch({
      title: "todo 2",
      description: "zzzz",
    });
    expect(todoItem2Model.isRegistered).eq(true);
    expect(todoItem2Model.getters.summary).eq("todo 2: zzzz");
    expect(todoListModel.state.ids).deep.eq(["1", "2"]);
    expect(todoListModel.getters.items).deep.eq([
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
