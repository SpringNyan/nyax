import {
  createModelDefinitionBaseClass,
  createNyax,
  defineModelDefinition,
  Store,
} from "@nyax/core";
import { expect } from "chai";
import { createStore } from "../src/index";

function waitTime(timeout: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

interface Dependencies {
  packageName: string;
  store: Store;
}

const dependencies: Omit<Dependencies, "store"> = {
  packageName: "@nyax/vuex",
};

const ModelDefinitionBase = createModelDefinitionBaseClass<Dependencies>();

describe("@nyax/vuex", () => {
  it("test static model", async () => {
    const FooModelDefinition = defineModelDefinition(
      "foo",
      class extends ModelDefinitionBase {
        private _nameAgeCalcTimes = 0;

        public initialState = {
          name: "nyan",
          age: 17,
          email: "nyan@example.com",

          nameChangeTimes: 0,
        };

        public selectors = {
          nameAge: () => {
            this._nameAgeCalcTimes += 1;
            return `${this.state.name}_${this.state.age}`;
          },
          nameAgeCalcTimes: () => this._nameAgeCalcTimes,
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
          },
          setNameAfter20ms: async (value: string) => {
            await waitTime(10);
            await this.actions.setNameAfter10ms.dispatch(value);
          },
        };

        public subscriptions = {
          nameChange: () => {
            return this.dependencies.store.subscribeDispatchAction(
              async (action) => {
                if (this.actions.setName.is(action)) {
                  await this.actions.increaseNameChangeTimes.dispatch({});
                }
              }
            );
          },
        };
      }
    );

    const store = createStore({});
    const nyax = createNyax({
      dependencies,
      store,
    });
    const { getModel } = nyax;

    const foo = getModel(FooModelDefinition);
    expect(foo.namespace).eq("foo");
    expect(foo.key).eq(undefined);

    expect(foo.isRegistered).eq(false);
    expect(foo.state.name).eq("nyan");
    expect(foo.state.age).eq(17);
    expect(foo.state.email).eq("nyan@example.com");
    expect(foo.getters.nameAge).eq("nyan_17");
    expect(foo.getters.nameAgeCalcTimes).eq(1);

    foo.register();
    expect(foo.isRegistered).eq(true);
    expect(foo.state.name).eq("nyan");
    expect(foo.state.age).eq(17);
    expect(foo.state.email).eq("nyan@example.com");
    expect(foo.getters.nameAge).eq("nyan_17");
    expect(foo.getters.nameAgeCalcTimes).eq(1);

    foo.actions.setName.dispatch("wwww");
    expect(foo.state.name).eq("wwww");
    expect(foo.getters.nameAge).eq("wwww_17");
    expect(foo.getters.nameAgeCalcTimes).eq(2);

    foo.actions.setEmail.dispatch("wwww@example.com");
    expect(foo.state.email).eq("wwww@example.com");
    expect(foo.getters.nameAge).eq("wwww_17");
    expect(foo.getters.nameAgeCalcTimes).eq(2);

    foo.actions.setNameAfter10ms.dispatch("nyan10");
    expect(foo.state.name).eq("wwww");
    await waitTime(10);
    expect(foo.state.name).eq("nyan10");

    await (async () => {
      const promise = foo.actions.setNameAfter20ms.dispatch("nyan20");
      await waitTime(10);
      expect(foo.state.name).eq("nyan10");
      await promise;
      expect(foo.state.name).eq("nyan20");
    })();

    expect(foo.getters.nameAge).eq("nyan20_17");
    expect(foo.getters.nameAgeCalcTimes).eq(4);
    store.dispatch(foo.actions.setAge.create(233));
    expect(foo.getters.nameAge).eq("nyan20_233");
    expect(foo.getters.nameAgeCalcTimes).eq(5);

    store.dispatch({
      type: "foo/setAge",
      payload: 666,
    });
    expect(foo.getters.nameAge).eq("nyan20_666");
    expect(foo.getters.nameAgeCalcTimes).eq(6);

    expect(foo.state.nameChangeTimes).eq(3);
  });
});
