import { defineModelDefinition } from "../../src";
import { testDependencies } from "../dependencies";
import { TodoItemModelDefinition } from "./todoItem";
import { ModelDefinitionBase } from "./_base";

export const TodoListModelDefinition = defineModelDefinition(
  "todo.list",
  class extends ModelDefinitionBase {
    public initialState() {
      return {
        ids: [] as string[],

        nextId: 1,
      };
    }

    public selectors() {
      return {
        items: testDependencies.createSelector(
          () => this.state.ids,
          () => this.nyax.getState(TodoItemModelDefinition),
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-non-null-asserted-optional-chain
          (ids, state) => ids.map((id) => state?.[id]!).filter(Boolean)
        ),
      };
    }

    public reducers() {
      return {
        addId: (id: string) => {
          this.state.ids.push(id);
        },
        removeId: (id: string) => {
          this.state.ids = this.state.ids.filter((e) => e !== id);
        },

        increaseNextId: () => {
          this.state.nextId += 1;
        },
      };
    }

    public effects() {
      return {
        add: async (item: { title: string; description: string }) => {
          const id = this.state.nextId + "";
          await this.actions.increaseNextId.dispatch({});

          await this.getModel(
            TodoItemModelDefinition,
            id
          ).actions.load.dispatch({
            ...item,
            isDone: false,
          });
          await this.actions.addId.dispatch(id);

          return id;
        },
        remove: async (id: string) => {
          await this.actions.removeId.dispatch(id);
          this.getModel(TodoItemModelDefinition, id).unregister();
        },

        requestAllDone: async () => {
          // noop
        },
      };
    }
  }
);
