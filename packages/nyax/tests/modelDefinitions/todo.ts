import { createModelDefinition, extendModelDefinition } from "../../src";
import { todoItemModelDef } from "./todoItem";
import { baseModelDef } from "./_base";

export const todoModelDef = createModelDefinition(
  "todo",
  extendModelDefinition(baseModelDef, {
    state() {
      return {
        allIds: [] as string[],
        lastId: 0,
      };
    },
    selectors: {
      items() {
        return this.createSelector(
          () => this.nyax.getState(todoItemModelDef),
          () => this.state.allIds,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          (byId, allIds) => (byId ? allIds.map((id) => byId[id]!) : [])
        );
      },
      title() {
        return `${this.getters.dependencies.packageName} - ${this.state.allIds.length}`;
      },
    },
    reducers: {
      addId(id: string) {
        this.state.allIds.push(id);
      },
    },
    effects: {
      nextId() {
        this.patch((state) => ({
          lastId: state.lastId + 1,
        }));
        return "" + this.state.lastId;
      },
      add(payload: { title: string; description: string }) {
        const id = this.actions.nextId({});
        this.getModel(todoItemModelDef, id).patch(payload);
        this.actions.addId(id);
      },
      delete(id: string) {
        this.patch((state) => ({
          allIds: state.allIds.filter((e) => e !== id),
        }));
        this.getModel(todoItemModelDef, id).unmount();
      },
    },
  })
);
