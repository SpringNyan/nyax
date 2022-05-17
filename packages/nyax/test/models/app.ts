import { defineModel } from "../../src";
import { UserModel } from "./user";
import { ModelBase } from "./_base";

export const AppModel = defineModel(
  "app",
  class extends ModelBase {
    public override initialState() {
      return {
        isInitialized: false,
        errorMessage: null as string | null,

        initializedTimestamp: null as number | null,

        initializeTimes: 0,
        initializedTimes: 0,

        userAgeChangeTimes: 0,
      };
    }

    public override selectors() {
      return {
        packageName: () => {
          return this.dependencies.packageName;
        },
        userSummary: () => {
          return this.getContainer(UserModel).getters.summary;
        },
        userName: () => {
          return this.nyax.getState(UserModel)?.name;
        },
      };
    }

    public override reducers() {
      return {
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
    }

    public override effects() {
      return {
        initialize: async (payload: { errorMessage?: string }) => {
          const { errorMessage } = payload;
          if (errorMessage) {
            await this.actions.initializeFailure(errorMessage);
          } else {
            await this.actions.initializeSuccess({});
          }
        },
        initializeSuccess: async () => {
          await this.actions.setInitializedTimestamp(Date.now());
        },
      };
    }

    public override subscriptions() {
      return {
        initialize: () => {
          return this.nyax.store.subscribeAction(async (action) => {
            if (this.actions.initialize.is(action)) {
              await this.actions.increaseInitializeTimes({});
            }
          });
        },
        initializeSuccess: () => {
          return this.nyax.store.subscribeAction(async (action) => {
            if (this.actions.initializeSuccess.is(action)) {
              await this.actions.increaseInitializedTimes({});
            }
          });
        },
        userAgeChange: () => {
          return this.nyax.store.subscribeAction(async (action) => {
            if (this.getContainer(UserModel).actions.setAge.is(action)) {
              await this.actions.increaseUserAgeChangeTimes({});
            }
          });
        },
      };
    }
  }
);
