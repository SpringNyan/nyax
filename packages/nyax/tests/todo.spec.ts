import { expect } from "chai";
import { applyMiddleware, createStore } from "redux";
import { createNyax, NyaxOptions } from "../src";
import { todoModelDef } from "./modelDefinitions/todo";
import { todoItemModelDef } from "./modelDefinitions/todoItem";

function test(options?: { title?: string; nyaxOptions?: NyaxOptions }): void {
  const { title = "default", nyaxOptions } = options ?? {};

  it(title, async () => {
    const nyax = createNyax(nyaxOptions);
    const {
      store,
      getModel,
      getState,
      testAction,
      subscribeAction,
      registerModelDefinitions,
      reload,
    } = nyax;

    expect(() => getModel("todo")).throw();

    expect(getState()).eq(store.getState());
    expect(getModel(todoModelDef).state).not.eq(undefined);
    expect(getState(todoModelDef)).eq(undefined);

    expect(getModel("todo")).eq(getModel(todoModelDef));
    registerModelDefinitions([todoModelDef]);
    expect(getModel("todo")).eq(getModel(todoModelDef));

    expect(() => getModel("todoItem", "0")).throw();
    registerModelDefinitions([todoItemModelDef]);
    expect(() => getModel("todoItem", "0")).not.throw();
    expect(() => getModel("todoItem")).throw();

    const todoModel = getModel(todoModelDef);

    expect(todoModel.modelDefinition).eq(todoModelDef);
    expect(todoModel.namespace).eq("todo");
    expect(todoModel.key).eq(undefined);
    expect(todoModel.fullNamespace).eq("todo");
    expect(todoModel.isMounted).eq(false);

    expect(todoModel.state.allIds).deep.eq([]);
    expect(todoModel.state.lastId).eq(0);
    expect(todoModel.getters.dependencies.packageName).eq("nyax");
    expect(todoModel.getters.modelName).eq("todo");
    expect(todoModel.getters.items).deep.eq([]);
    expect(todoModel.getters.title).eq("nyax - 0");

    todoModel.mount({
      allIds: [],
      lastId: 233,
    });
    expect(todoModel.isMounted).eq(true);
    expect(todoModel.state).eq(getState(todoModelDef));
    expect(todoModel.state.allIds).deep.eq([]);
    expect(todoModel.state.lastId).eq(233);

    const todoItem234Model = getModel(todoItemModelDef, "234");
    expect(todoItem234Model.modelDefinition).eq(todoItemModelDef);
    expect(todoItem234Model.namespace).eq("todoItem");
    expect(todoItem234Model.key).eq("234");
    expect(todoItem234Model.fullNamespace).eq(
      "todoItem" + (nyaxOptions?.namespaceSeparator ?? "/") + "234"
    );
    expect(todoItem234Model.isMounted).eq(false);
    expect(todoItem234Model.state.id).eq("234");
    expect(todoItem234Model.state.titleChangeTimes).eq(0);
    expect(todoItem234Model.state.fromSummaryTimes).eq(0);
    expect(todoItem234Model.getters.idNum).eq(234);
    expect(todoItem234Model.getters.summary).eq("[ ]  - ");

    todoModel.actions.add({
      title: "nyan",
      description: "meow",
    });
    expect(todoItem234Model.isMounted).eq(true);
    expect(todoItem234Model.getters.idNum).eq(234);
    expect(todoItem234Model.getters.summary).eq("[ ] nyan - meow");
    expect(todoItem234Model.actions.toggleDone({})).eq("[x] nyan - meow");
    expect(todoItem234Model.state.titleChangeTimes).eq(1);
    expect(todoItem234Model.state.fromSummaryTimes).eq(0);

    todoItem234Model.actions.fromSummary("[ ] nyax - redux");
    expect(todoItem234Model.state.title).eq("nyax");
    expect(todoItem234Model.state.description).eq("redux");
    expect(todoItem234Model.state.done).eq(false);
    expect(todoItem234Model.state.titleChangeTimes).eq(2);
    expect(todoItem234Model.state.fromSummaryTimes).eq(1);

    {
      const promise = todoItem234Model.actions.doneAfterMs(20);
      expect(todoItem234Model.state.done).eq(false);
      const summary = await promise;
      expect(todoItem234Model.state.done).eq(true);
      expect(summary).eq("[x] nyax - redux");
    }

    expect(todoModel.state.allIds).deep.eq(["234"]);
    expect(todoModel.getters.items).deep.eq([todoItem234Model.state]);

    const snapshot = nyax.getState();

    todoItem234Model.set((state) => ({
      ...state,
      title: ":3",
    }));
    expect(todoItem234Model.state.title).eq(":3");

    todoModel.actions.delete("234");
    expect(todoModel.getters.items).deep.eq([]);
    expect(todoItem234Model.isMounted).eq(false);
    expect(todoItem234Model.getters.summary).eq("[ ]  - ");
    expect(todoItem234Model).not.eq(getModel(todoItemModelDef, "234"));
    expect(getState(todoItemModelDef)).eq(undefined);

    todoModel.actions.add({ title: "abc", description: "xyz" });
    todoModel.actions.add({ title: "123", description: "789" });
    expect(getModel(todoItemModelDef, "234").isMounted).eq(false);
    expect(getModel(todoItemModelDef, "235").isMounted).eq(true);
    expect(getModel(todoItemModelDef, "236").isMounted).eq(true);
    expect(getModel(todoItemModelDef, "237").isMounted).eq(false);
    expect(todoModel.getters.title).eq("nyax - 2");

    {
      let count = 0;
      const disposable = subscribeAction((action) => {
        const result = testAction(
          action,
          todoItemModelDef,
          (e) => e.fromSummary
        );
        if (result) {
          count += 1;
        }
      });
      getModel(todoItemModelDef, "235").actions.fromSummary("[ ] abc - xyz");
      getModel(todoItemModelDef, "236").actions.fromSummaryThenDone(
        "[ ] abc - xyz"
      );
      getModel(todoItemModelDef, "237").actions.toggleDone({});
      expect(count).eq(2);

      disposable();
    }

    reload(snapshot);
    expect(todoModel.state.lastId).eq(234);
    expect(getModel(todoModelDef).state.allIds).deep.eq(["234"]);
    expect(todoItem234Model.getters.summary).eq("[x] nyax - redux");
    expect(getModel(todoItemModelDef, "235").isMounted).eq(false);

    {
      const disposable = subscribeAction((action) => {
        if (todoItem234Model.actions.fromSummary.is(action)) {
          todoItem234Model.actions.toggleDone({});
        }
      });
      todoItem234Model.actions.fromSummary("[ ] abc - xyz");
      expect(todoItem234Model.getters.summary).eq("[x] abc - xyz");

      disposable();
      todoItem234Model.actions.fromSummary("[ ] xyz - abc");
      expect(todoItem234Model.getters.summary).eq("[ ] xyz - abc");
    }
  });
}

describe("todo", function () {
  test();
  test({
    title: "options",
    nyaxOptions: {
      createStore(reducer, middleware) {
        return createStore((state: any, action) => {
          state = reducer(state, action);
          state = { ...state, $lastAction: action };
          return state;
        }, applyMiddleware(middleware));
      },

      namespaceSeparator: ".",
      pathSeparator: "/",
    },
  });
});
