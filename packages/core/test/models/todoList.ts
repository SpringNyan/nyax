import { defineModel } from "../../src";
import { testDependencies } from "../dependencies";
import { TodoItemModel } from "./todoItem";
import { ModelBase } from "./_base";

export const TodoListModel = defineModel(
  "todo.list",
  class extends ModelBase {
    public override initialState() {
      return {
        ids: [] as string[],

        nextId: 1,
      };
    }

    public override selectors() {
      return {
        items: testDependencies.createSelector(
          () => this.state.ids,
          () => this.nyax.getState(TodoItemModel),
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-non-null-asserted-optional-chain
          (ids, state) => ids.map((id) => state?.[id]!).filter(Boolean)
        ),
      };
    }

    public override reducers() {
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

    public override effects() {
      return {
        add: async (item: { title: string; description: string }) => {
          const id = this.state.nextId + "";
          await this.actions.increaseNextId({});

          await this.getContainer(TodoItemModel, id).actions.load({
            ...item,
            isDone: false,
          });
          await this.actions.addId(id);

          return id;
        },
        remove: async (id: string) => {
          await this.actions.removeId(id);
          this.getContainer(TodoItemModel, id).unregister();
        },

        requestAllDone: async () => {
          // noop
        },
      };
    }
  }
);
