import { defineModel } from "../../src";
import { testDependencies } from "../dependencies";
import { waitTime } from "../utils";
import { ModelBase } from "./_base";

export const UserModel = defineModel(
  "user",
  class extends ModelBase {
    public override initialState() {
      return {
        name: "nyan",
        age: 17,
        email: "nyan@example.com",

        nameChangeTimes: 0,
      };
    }

    public override selectors() {
      return {
        summary: testDependencies.createSelector(
          () => this.state.name,
          () => this.state.age,
          (name, age) => `name: ${name}; age: ${age}`
        ),
      };
    }

    public override reducers() {
      return {
        setName: (value: string) => {
          this.state.name = value;
        },
        setAge: (value: number) => {
          this.state.age = value;
        },
        setEmail: (value: string) => {
          this.state.email = value;
        },
        increaseNameChangeTimes: () => {
          this.state.nameChangeTimes += 1;
        },
      };
    }

    public override effects() {
      return {
        setNameAfter10ms: async (value: string) => {
          await waitTime(10);
          await this.actions.setName(value);
          return value;
        },
        setNameAfter20ms: async (value: string) => {
          await waitTime(10);
          await this.actions.setNameAfter10ms(value);
          return value;
        },
      };
    }

    public override subscriptions() {
      return {
        nameChange: () => {
          return this.nyax.store.subscribeAction(async (action) => {
            if (this.actions.setName.is(action)) {
              await this.actions.increaseNameChangeTimes({});
            }
          });
        },
      };
    }
  }
);
