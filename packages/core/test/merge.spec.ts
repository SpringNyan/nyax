import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import { AppModelDefinition } from "./models/app";
import { UserModelDefinition } from "./models/user";
import { waitTime } from "./utils";

export function test(options: {
  packageName: string;
  createStore: CreateStore;
  createSelector?: CreateSelector;
}): void {
  const dependencies: Dependencies = {
    packageName: options.packageName,
  };
  testDependencies.createSelector =
    options.createSelector ?? defaultCreateSelector;

  it("merge", async () => {
    const nyax = createNyax({
      dependencies,
      createStore: options.createStore,
    });
    const { store, getState, getModel, registerModelDefinitionClasses } = nyax;

    expect(() => getModel("app")).throw();

    expect(getState()).eq(store.getState());

    expect(getState(AppModelDefinition)).eq(undefined);
    expect(getModel(AppModelDefinition).state).not.eq(undefined);

    registerModelDefinitionClasses(AppModelDefinition);

    expect(getState()).eq(store.getState());
    expect(getState(AppModelDefinition)).eq(getModel(AppModelDefinition).state);

    const appModel = getModel(AppModelDefinition);
    const userModel = getModel(UserModelDefinition);

    expect(appModel).eq(getModel("app"));
    expect(appModel.namespace).eq("app");
    expect(appModel.key).eq(undefined);
    expect(appModel.isRegistered).eq(true);

    expect(appModel.state.isInitialized).eq(false);
    expect(appModel.state.errorMessage).eq(null);
    expect(appModel.getters.packageName).eq(options.packageName);

    expect(userModel).eq(getModel("user"));
    expect(userModel.namespace).eq("user");
    expect(userModel.key).eq(undefined);
    expect(userModel.isRegistered).eq(false);

    expect(userModel.state.name).eq("nyan");
    expect(userModel.state.age).eq(17);
    expect(userModel.state.email).eq("nyan@example.com");
    expect(userModel.getters.summary).eq("name: nyan; age: 17");

    expect(getState(UserModelDefinition)).eq(undefined);
    expect(getModel(UserModelDefinition).state).not.eq(undefined);

    userModel.register();
    expect(userModel.isRegistered).eq(true);

    expect(getState(UserModelDefinition)).eq(
      getModel(UserModelDefinition).state
    );

    expect(userModel.state.name).eq("nyan");
    expect(userModel.state.age).eq(17);
    expect(userModel.state.email).eq("nyan@example.com");
    expect(userModel.getters.summary).eq("name: nyan; age: 17");

    expect(appModel.state.initializeTimes).eq(0);

    await appModel.actions.initialize.dispatch({
      errorMessage: "Orz",
    });
    expect(appModel.state.isInitialized).eq(false);
    expect(appModel.state.errorMessage).eq("Orz");
    expect(appModel.state.initializedTimestamp).eq(null);
    expect(appModel.state.initializedTimes).eq(0);

    expect(appModel.state.initializeTimes).eq(1);

    await appModel.actions.initialize.dispatch({});
    expect(appModel.state.isInitialized).eq(true);
    expect(appModel.state.errorMessage).eq(null);
    expect(appModel.state.initializedTimestamp).not.eq(null);
    expect(appModel.state.initializedTimes).eq(1);

    expect(appModel.state.initializeTimes).eq(2);

    userModel.actions.setName.dispatch("meow");
    expect(userModel.state.name).eq("meow");
    expect(userModel.getters.summary).eq("name: meow; age: 17");

    userModel.actions.setEmail.dispatch("meow@example.com");
    expect(userModel.state.email).eq("meow@example.com");
    expect(userModel.getters.summary).eq("name: meow; age: 17");

    userModel.actions.setNameAfter10ms.dispatch("nyan10");
    expect(userModel.state.name).eq("meow");
    await waitTime(10);
    expect(userModel.state.name).eq("nyan10");

    await (async () => {
      const promise = userModel.actions.setNameAfter20ms.dispatch("nyan20");
      await waitTime(10);
      expect(userModel.state.name).eq("nyan10");
      const result = await promise;
      expect(userModel.state.name).eq("nyan20");
      expect(result).eq("nyan20");
    })();

    expect(userModel.getters.summary).eq("name: nyan20; age: 17");
    store.dispatch(userModel.actions.setAge.create(233));
    expect(userModel.getters.summary).eq("name: nyan20; age: 233");

    store.dispatch({ type: "user/setAge", payload: 666 });
    expect(userModel.state.age).eq(666);

    expect(userModel.state.nameChangeTimes).eq(3);
    expect(appModel.state.userAgeChangeTimes).eq(2);

    userModel.unregister();

    expect(getState(UserModelDefinition)).eq(undefined);
    expect(getModel(UserModelDefinition).state).not.eq(undefined);

    expect(userModel.state.name).eq("nyan");
    expect(userModel.state.age).eq(17);
    expect(userModel.state.email).eq("nyan@example.com");
    expect(userModel.getters.summary).eq("name: nyan; age: 17");

    userModel.actions.setEmail.dispatch("meow@example.com");
    expect(userModel.state.email).eq("meow@example.com");

    appModel.unregister();
    expect(appModel.state.userAgeChangeTimes).eq(0);
    userModel.actions.setAge.dispatch(998);
    expect(appModel.state.userAgeChangeTimes).eq(0);
    appModel.register();
    expect(appModel.state.userAgeChangeTimes).eq(0);
    userModel.actions.setAge.dispatch(666);
    expect(appModel.state.userAgeChangeTimes).eq(1);
  });
}
