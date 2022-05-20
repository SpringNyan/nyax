import { createModelDefinition } from "../../src";
import { waitMs } from "../utils";

export const todoItemModelDef = createModelDefinition(
  "todoItem",
  {
    state() {
      return {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: this.key!,
        title: "",
        description: "",
        done: false,

        titleChangeTimes: 0,
        fromSummaryTimes: 0,
      };
    },
    selectors: {
      idNum() {
        return Number(this.state.id);
      },
      summary() {
        return this.createSelector(
          () => this.state.done,
          () => this.state.title,
          () => this.state.description,
          (done, title, description) =>
            `${done ? "[x]" : "[ ]"} ${title} - ${description}`
        );
      },
    },
    reducers: {
      toggleDone() {
        this.state.done = !this.state.done;
      },
      fromSummary(summary: string) {
        this.state.done = summary.startsWith("[x]");
        [this.state.title = "", this.state.description = ""] = summary
          .substring(3)
          .split("-")
          .map((str) => str.trim());
      },
    },
    effects: {
      toggleDone() {
        return this.getters.summary;
      },
      fromSummaryThenDone(summary: string) {
        this.actions.fromSummary(summary);
        this.patch({ done: true });
        return this.getters.summary;
      },
      async doneAfterMs(ms: number) {
        await waitMs(ms);
        this.patch({ done: true });
        return this.getters.summary;
      },
    },
    subscriptions: {
      titleChangeTimes() {
        let lastTitle = this.state.title;
        return this.nyax.subscribeAction(() => {
          if (this.state.title !== lastTitle) {
            lastTitle = this.state.title;
            this.patch((state) => ({
              titleChangeTimes: state.titleChangeTimes + 1,
            }));
          }
        });
      },
      fromSummaryTimes() {
        return this.nyax.subscribeAction((action) => {
          if (this.actions.fromSummary.is(action)) {
            this.patch((state) => ({
              fromSummaryTimes: state.fromSummaryTimes + 1,
            }));
          }
        });
      },
    },
  },
  true
);
