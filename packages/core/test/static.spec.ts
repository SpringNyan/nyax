import { expect } from "chai";
import { createNyax, CreateStore } from "../src";
import {
  CreateSelector,
  defaultCreateSelector,
  Dependencies,
  testDependencies,
} from "./dependencies";
import { AppModel } from "./models/app";
import { UserModel } from "./models/user";
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

  it("static", async () => {
    const nyax = createNyax({
      dependencies,
      createStore: options.createStore,
    });
    const { store, getState, getContainer, registerModelClasses } = nyax;

    expect(() => getContainer("app")).throw();

    expect(getState()).eq(store.getState());

    expect(getState(AppModel)).eq(undefined);
    expect(getContainer(AppModel).state).not.eq(undefined);

    registerModelClasses(AppModel);

    expect(getState()).eq(store.getState());
    expect(getState(AppModel)).eq(getContainer(AppModel).state);

    const appContainer = getContainer(AppModel);
    const userContainer = getContainer(UserModel);

    expect(appContainer).eq(getContainer("app"));
    expect(appContainer.namespace).eq("app");
    expect(appContainer.key).eq(undefined);
    expect(appContainer.isRegistered).eq(true);

    expect(appContainer.state.isInitialized).eq(false);
    expect(appContainer.state.errorMessage).eq(null);
    expect(appContainer.getters.packageName).eq(options.packageName);
    expect(appContainer.getters.userSummary).eq("name: nyan; age: 17");
    expect(appContainer.getters.userName).eq(undefined);

    expect(userContainer).eq(getContainer("user"));
    expect(userContainer.namespace).eq("user");
    expect(userContainer.key).eq(undefined);
    expect(userContainer.isRegistered).eq(false);

    expect(userContainer.state.name).eq("nyan");
    expect(userContainer.state.age).eq(17);
    expect(userContainer.state.email).eq("nyan@example.com");
    expect(userContainer.getters.summary).eq("name: nyan; age: 17");

    expect(getState(UserModel)).eq(undefined);
    expect(getContainer(UserModel).state).not.eq(undefined);

    userContainer.register();
    expect(userContainer.isRegistered).eq(true);

    expect(getState(UserModel)).eq(getContainer(UserModel).state);

    expect(userContainer.state.name).eq("nyan");
    expect(userContainer.state.age).eq(17);
    expect(userContainer.state.email).eq("nyan@example.com");
    expect(userContainer.getters.summary).eq("name: nyan; age: 17");
    expect(appContainer.getters.userName).eq("nyan");

    expect(appContainer.state.initializeTimes).eq(0);

    await appContainer.actions.initialize({ errorMessage: "Orz" });
    expect(appContainer.state.isInitialized).eq(false);
    expect(appContainer.state.errorMessage).eq("Orz");
    expect(appContainer.state.initializedTimestamp).eq(null);
    expect(appContainer.state.initializedTimes).eq(0);

    expect(appContainer.state.initializeTimes).eq(1);

    await appContainer.actions.initialize({});
    expect(appContainer.state.isInitialized).eq(true);
    expect(appContainer.state.errorMessage).eq(null);
    expect(appContainer.state.initializedTimestamp).not.eq(null);
    expect(appContainer.state.initializedTimes).eq(1);

    expect(appContainer.state.initializeTimes).eq(2);

    userContainer.actions.setName("meow");
    expect(userContainer.state.name).eq("meow");
    expect(userContainer.getters.summary).eq("name: meow; age: 17");

    userContainer.actions.setEmail.dispatch("meow@example.com");
    expect(userContainer.state.email).eq("meow@example.com");
    expect(userContainer.getters.summary).eq("name: meow; age: 17");

    userContainer.actions.setNameAfter10ms("nyan10");
    expect(userContainer.state.name).eq("meow");
    await waitTime(10);
    expect(userContainer.state.name).eq("nyan10");

    await (async () => {
      const promise = userContainer.actions.setNameAfter20ms("nyan20");
      await waitTime(10);
      expect(userContainer.state.name).eq("nyan10");
      const result = await promise;
      expect(userContainer.state.name).eq("nyan20");
      expect(result).eq("nyan20");
    })();

    expect(userContainer.getters.summary).eq("name: nyan20; age: 17");
    store.dispatch(userContainer.actions.setAge.create(233));
    expect(userContainer.getters.summary).eq("name: nyan20; age: 233");

    store.dispatch({ type: "user/setAge", payload: 666 });
    expect(userContainer.state.age).eq(666);

    expect(userContainer.state.nameChangeTimes).eq(3);
    expect(appContainer.state.userAgeChangeTimes).eq(2);

    userContainer.unregister();

    expect(getState(UserModel)).eq(undefined);
    expect(getContainer(UserModel).state).not.eq(undefined);

    expect(userContainer.state.name).eq("nyan");
    expect(userContainer.state.age).eq(17);
    expect(userContainer.state.email).eq("nyan@example.com");
    expect(userContainer.getters.summary).eq("name: nyan; age: 17");

    userContainer.actions.setEmail("meow@example.com");
    expect(userContainer.state.email).eq("meow@example.com");

    appContainer.unregister();
    expect(appContainer.state.userAgeChangeTimes).eq(0);
    userContainer.actions.setAge(998);
    expect(appContainer.state.userAgeChangeTimes).eq(0);
    appContainer.register();
    expect(appContainer.state.userAgeChangeTimes).eq(0);
    userContainer.actions.setAge(666);
    expect(appContainer.state.userAgeChangeTimes).eq(1);
  });
}
