import {
  defineModelDefinition,
  mergeModelDefinitionClasses,
  mergeSubModelDefinitionClasses,
} from "../../src";
import { testDependencies } from "../dependencies";
import { ModelDefinitionBase } from "./_base";

class FooEntityModelDefinition extends ModelDefinitionBase {
  public initialState = {
    foo: "foo",
  };

  public selectors = {
    foo$foo: testDependencies.createSelector(
      () => this.state.foo,
      (foo) => `${foo}$${foo}`
    ),
  };

  public reducers = {
    setFoo: (value: string) => {
      this.state.foo = value;
    },
  };

  public effects = {
    setFooUpper: async (value: string) => {
      await this.actions.setFoo.dispatch(value.toUpperCase());
    },
  };

  public subscriptions = {
    fooChange: () =>
      this.nyax.store.subscribeAction(async (action) => {
        if (this.actions.setFoo.is(action)) {
          await this.getModel(
            MergedEntityModelDefinition
          ).actions.increaseFooChangeTimes.dispatch({});
        }
      }),
  };
}

class BarEntityModelDefinition extends ModelDefinitionBase {
  public initialState = {
    bar: "bar",
  };

  public selectors = {
    bar_bar: testDependencies.createSelector(
      () => this.state.bar,
      (bar) => `${bar}_${bar}`
    ),
  };

  public reducers = {
    setBar: (value: string) => {
      this.state.bar = value;
    },
  };

  public effects = {
    setBarLower: async (value: string) => {
      await this.actions.setBar.dispatch(value.toLowerCase());
    },
  };

  public subscriptions = {
    barChange: () =>
      this.nyax.store.subscribeAction(async (action) => {
        if (this.actions.setBar.is(action)) {
          await this.getModel(
            MergedSubEntityModelDefinition
          ).actions.increaseBarChangeTimes.dispatch({});
        }
      }),
  };
}

class BazEntityModelDefinition extends ModelDefinitionBase {
  public initialState = {
    baz: "baz",
  };

  public selectors = {
    baz0baz: testDependencies.createSelector(
      () => this.state.baz,
      (baz) => `${baz}0${baz}`
    ),
  };

  public reducers = {
    setBaz: (value: string) => {
      this.state.baz = value;
    },
  };

  public effects = {
    setBazTrim: async (value: string) => {
      await this.actions.setBaz.dispatch(value.trim());
    },
  };
}

export const MergedEntityModelDefinition = defineModelDefinition(
  "mergedEntity",
  class extends mergeModelDefinitionClasses(
    FooEntityModelDefinition,
    BarEntityModelDefinition,
    BazEntityModelDefinition
  ) {
    public initialState = {
      ...super.initialState,

      fooChangeTimes: 0,
    };

    public selectors = {
      ...super.selectors,

      fooBarBaz: testDependencies.createSelector(
        () => this.state.foo,
        () => this.state.bar,
        () => this.state.baz,
        (foo, bar, baz) => `${foo}${bar}${baz}`
      ),
    };

    public reducers = {
      ...super.reducers,

      increaseFooChangeTimes: () => {
        this.state.fooChangeTimes += 1;
      },
    };

    public effects = {
      ...super.effects,

      setFooBarBaz: async (payload: {
        foo: string;
        bar: string;
        baz: string;
      }) => {
        await this.actions.setFoo.dispatch(payload.foo);
        await this.actions.setBar.dispatch(payload.bar);
        await this.actions.setBaz.dispatch(payload.baz);
      },
    };
  }
);

export const MergedSubEntityModelDefinition = defineModelDefinition(
  "mergedSubEntity",
  class extends mergeSubModelDefinitionClasses({
    foo: FooEntityModelDefinition,
    bar: BarEntityModelDefinition,
    baz: BazEntityModelDefinition,
  }) {
    public initialState = {
      ...super.initialState,

      barChangeTimes: 0,
    };

    public selectors = {
      ...super.selectors,

      fooBarBaz: testDependencies.createSelector(
        () => this.state.foo.foo,
        () => this.state.bar.bar,
        () => this.state.baz.baz,
        (foo, bar, baz) => `${foo}${bar}${baz}`
      ),
    };

    public reducers = {
      ...super.reducers,

      increaseBarChangeTimes: () => {
        this.state.barChangeTimes += 1;
      },
    };

    public effects = {
      ...super.effects,

      setFooBarBaz: async (payload: {
        foo: string;
        bar: string;
        baz: string;
      }) => {
        await this.actions.foo.setFoo.dispatch(payload.foo);
        await this.actions.bar.setBar.dispatch(payload.bar);
        await this.actions.baz.setBaz.dispatch(payload.baz);
      },
    };
  }
);
