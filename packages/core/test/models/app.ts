import { defineModelDefinition } from "../../src";
import { UserModelDefinition } from "./user";
import { ModelDefinitionBase } from "./_base";

export const AppModelDefinition = defineModelDefinition(
  "app",
  class extends ModelDefinitionBase {
    public override initialState = {
      isInitialized: false,
      errorMessage: null as string | null,

      initializedTimestamp: null as number | null,

      initializeTimes: 0,
      initializedTimes: 0,

      userAgeChangeTimes: 0,
    };

    public override selectors = {
      packageName: () => {
        return this.dependencies.packageName;
      },
    };

    public override reducers = {
      initializeSuccess: () => {
        this.state.isInitialized = true;
        this.state.errorMessage = null;
      },
      initializeFailure: (errorMessage: string) => {
        this.state.isInitialized = false;
        this.state.errorMessage = errorMessage;
      },
      setInitializedTimestamp: (timestamp: number) => {
        this.state.initializedTimestamp = timestamp;
      },
      increaseInitializeTimes: () => {
        this.state.initializeTimes += 1;
      },
      increaseInitializedTimes: () => {
        this.state.initializedTimes += 1;
      },
      increaseUserAgeChangeTimes: () => {
        this.state.userAgeChangeTimes += 1;
      },
    };

    public override effects = {
      initialize: async (payload: { errorMessage?: string }) => {
        const { errorMessage } = payload;
        if (errorMessage) {
          await this.actions.initializeFailure.dispatch(errorMessage);
        } else {
          await this.actions.initializeSuccess.dispatch({});
        }
      },
      initializeSuccess: async () => {
        await this.actions.setInitializedTimestamp.dispatch(Date.now());
      },
    };

    public override subscriptions = {
      initialize: () => {
        return this.nyax.store.subscribeAction(async (action) => {
          if (this.actions.initialize.is(action)) {
            await this.actions.increaseInitializeTimes.dispatch({});
          }
        });
      },
      initializeSuccess: () => {
        return this.nyax.store.subscribeAction(async (action) => {
          if (this.actions.initializeSuccess.is(action)) {
            await this.actions.increaseInitializedTimes.dispatch({});
          }
        });
      },
      userAgeChange: () => {
        return this.nyax.store.subscribeAction(async (action) => {
          if (this.getModel(UserModelDefinition).actions.setAge.is(action)) {
            await this.actions.increaseUserAgeChangeTimes.dispatch({});
          }
        });
      },
    };
  }
);
