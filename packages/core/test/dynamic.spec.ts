import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import { Dependencies } from "./dependencies";
import { TodoItemModelDefinition } from "./models/todoItem";
import { TodoListModelDefinition } from "./models/todoList";

export function test(options: {
  packageName: string;
  createStore: CreateStore;
}): void {
  const dependencies: Dependencies = {
    packageName: options.packageName,
  };

  describe(options.packageName, () => {
    it("dynamic", async () => {
      const nyax = createNyax({
        dependencies,
        createStore: options.createStore,
      });
      const {
        store,
        getState,
        getModel,
        registerModelDefinitionClasses,
      } = nyax;

      const todoListModel = getModel(TodoListModelDefinition);
      const getTodoItemModel = (id: string) =>
        getModel(TodoItemModelDefinition, id);

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

      expect(getTodoItemModel("1").isRegistered).eq(true);
    });
  });
}
