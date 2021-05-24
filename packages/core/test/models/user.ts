import { defineModelDefinition } from "../../src";
import { testDependencies } from "../dependencies";
import { waitTime } from "../utils";
import { ModelDefinitionBase } from "./_base";

export const UserModelDefinition = defineModelDefinition(
  "user",
  class extends ModelDefinitionBase {
    public initialState = {
      name: "nyan",
      age: 17,
      email: "nyan@example.com",

      nameChangeTimes: 0,
    };

    public selectors = {
      summary: testDependencies.createSelector(
        () => this.state.name,
        () => this.state.age,
        (name, age) => `name: ${name}; age: ${age}`
      ),
    };

    public reducers = {
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

    public effects = {
      setNameAfter10ms: async (value: string) => {
        await waitTime(10);
        await this.actions.setName.dispatch(value);
        return value;
      },
      setNameAfter20ms: async (value: string) => {
        await waitTime(10);
        await this.actions.setNameAfter10ms.dispatch(value);
        return value;
      },
    };

    public subscriptions = {
      nameChange: () => {
        return this.nyax.store.subscribeAction(async (action) => {
          if (this.actions.setName.is(action)) {
            await this.actions.increaseNameChangeTimes.dispatch({});
          }
        });
      },
    };
  }
);
