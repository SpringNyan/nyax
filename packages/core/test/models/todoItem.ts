import { defineModelDefinition } from "../../src";
import { testDependencies } from "../dependencies";
import { TodoListModelDefinition } from "./todoList";
import { ModelDefinitionBase } from "./_base";

export const TodoItemModelDefinition = defineModelDefinition(
  "todo.item",
  class extends ModelDefinitionBase {
    public override initialState() {
      return {
        title: "",
        description: "",

        isDone: false,
      };
    }

    public override selectors() {
      return {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: () => this.key!,
        summary: testDependencies.createSelector(
          () => this.state.isDone,
          () => this.state.title,
          () => this.state.description,
          (isDone, title, description) =>
            `${isDone ? "[DONE] " : ""}${title}: ${description}`
        ),
      };
    }

    public override reducers() {
      return {
        setTitle: (value: string) => {
          this.state.title = value;
        },
        setDescription: (value: string) => {
          this.state.description = value;
        },
        setIsDone: (value: boolean) => {
          this.state.isDone = value;
        },
      };
    }

    public override effects() {
      return {
        load: async (payload: {
          title: string;
          description: string;
          isDone: boolean;
        }) => {
          await this.actions.setTitle(payload.title);
          await this.actions.setDescription(payload.description);
          await this.actions.setIsDone(payload.isDone);
        },
      };
    }

    public override subscriptions() {
      return {
        allDone: () =>
          this.nyax.store.subscribeAction(async (action) => {
            if (
              this.getModel(TodoListModelDefinition).actions.requestAllDone.is(
                action
              )
            ) {
              await this.actions.setIsDone(true);
            }
          }),
      };
    }
  },
  true
);
