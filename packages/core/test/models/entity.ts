import {
  defineModelDefinition,
  mergeModelDefinitionClasses,
  mergeSubModelDefinitionClasses,
} from "../../src";
import { testDependencies } from "../dependencies";
import { ModelDefinitionBase } from "./_base";

class FooEntityModelDefinition extends ModelDefinitionBase {
  public override initialState() {
    return {
      foo: "foo",
    };
  }

  public override selectors() {
    return {
      foo$foo: testDependencies.createSelector(
        () => this.state.foo,
        (foo) => `${foo}$${foo}`
      ),
    };
  }

  public override reducers() {
    return {
      setFoo: (value: string) => {
        this.state.foo = value;
      },
    };
  }

  public override effects() {
    return {
      setFooUpper: async (value: string) => {
        await this.actions.setFoo(value.toUpperCase());
      },
    };
  }

  public override subscriptions() {
    return {
      fooChange: () =>
        this.nyax.store.subscribeAction(async (action) => {
          if (this.actions.setFoo.is(action)) {
            await this.getModel(
              MergedEntityModelDefinition
            ).actions.increaseFooChangeTimes({});
          }
        }),
    };
  }
}

class BarEntityModelDefinition extends ModelDefinitionBase {
  public override initialState() {
    return {
      bar: "bar",
    };
  }

  public override selectors() {
    return {
      bar_bar: testDependencies.createSelector(
        () => this.state.bar,
        (bar) => `${bar}_${bar}`
      ),
    };
  }

  public override reducers() {
    return {
      setBar: (value: string) => {
        this.state.bar = value;
      },
    };
  }

  public override effects() {
    return {
      setBarLower: async (value: string) => {
        await this.actions.setBar(value.toLowerCase());
      },
    };
  }

  public override subscriptions() {
    return {
      barChange: () =>
        this.nyax.store.subscribeAction(async (action) => {
          if (this.actions.setBar.is(action)) {
            await this.getModel(
              MergedSubEntityModelDefinition
            ).actions.increaseBarChangeTimes({});
          }
        }),
    };
  }
}

class BazEntityModelDefinition extends ModelDefinitionBase {
  public override initialState() {
    return {
      baz: "baz",
    };
  }

  public override selectors() {
    return {
      baz0baz: testDependencies.createSelector(
        () => this.state.baz,
        (baz) => `${baz}0${baz}`
      ),
    };
  }

  public override reducers() {
    return {
      setBaz: (value: string) => {
        this.state.baz = value;
      },
    };
  }

  public override effects() {
    return {
      setBazTrim: async (value: string) => {
        await this.actions.setBaz(value.trim());
      },
    };
  }
}

export const MergedEntityModelDefinition = defineModelDefinition(
  "mergedEntity",
  class extends mergeModelDefinitionClasses(
    FooEntityModelDefinition,
    BarEntityModelDefinition,
    BazEntityModelDefinition
  ) {
    public override initialState() {
      return {
        ...super.initialState(),

        fooChangeTimes: 0,
      };
    }

    public override selectors() {
      return {
        ...super.selectors(),

        fooBarBaz: testDependencies.createSelector(
          () => this.state.foo,
          () => this.state.bar,
          () => this.state.baz,
          (foo, bar, baz) => `${foo}${bar}${baz}`
        ),
      };
    }

    public override reducers() {
      return {
        ...super.reducers(),

        increaseFooChangeTimes: () => {
          this.state.fooChangeTimes += 1;
        },
      };
    }

    public override effects() {
      return {
        ...super.effects(),

        setFooBarBaz: async (payload: {
          foo: string;
          bar: string;
          baz: string;
        }) => {
          await this.actions.setFoo(payload.foo);
          await this.actions.setBar(payload.bar);
          await this.actions.setBaz(payload.baz);
        },
      };
    }
  }
);

export const MergedSubEntityModelDefinition = defineModelDefinition(
  "mergedSubEntity",
  class extends mergeSubModelDefinitionClasses({
    foo: FooEntityModelDefinition,
    bar: BarEntityModelDefinition,
    baz: BazEntityModelDefinition,
  }) {
    public override initialState() {
      return {
        ...super.initialState(),

        barChangeTimes: 0,
      };
    }

    public override selectors() {
      return {
        ...super.selectors(),

        fooBarBaz: testDependencies.createSelector(
          () => this.state.foo.foo,
          () => this.state.bar.bar,
          () => this.state.baz.baz,
          (foo, bar, baz) => `${foo}${bar}${baz}`
        ),
      };
    }

    public override reducers() {
      return {
        ...super.reducers(),

        increaseBarChangeTimes: () => {
          this.state.barChangeTimes += 1;
        },
      };
    }

    public override effects() {
      return {
        ...super.effects(),

        setFooBarBaz: async (payload: {
          foo: string;
          bar: string;
          baz: string;
        }) => {
          await this.actions.foo.setFoo(payload.foo);
          await this.actions.bar.setBar(payload.bar);
          await this.actions.baz.setBaz(payload.baz);
        },
      };
    }
  }
);
