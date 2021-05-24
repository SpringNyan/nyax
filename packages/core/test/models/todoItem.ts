import { defineModelDefinition } from "../../src";
import { testDependencies } from "../dependencies";
import { ModelDefinitionBase } from "./_base";

export const TodoItemModelDefinition = defineModelDefinition(
  "todo.item",
  class extends ModelDefinitionBase {
    public initialState = {
      title: "",
      description: "",

      isDone: false,
    };

    public selectors = {
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

    public reducers = {
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

    public effects = {
      load: async (payload: {
        title: string;
        description: string;
        isDone: boolean;
      }) => {
        await this.actions.setTitle.dispatch(payload.title);
        await this.actions.setDescription.dispatch(payload.description);
        await this.actions.setIsDone.dispatch(payload.isDone);
      },
    };
  }
);
