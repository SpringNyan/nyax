import { expect } from "chai";
import { interval, timer } from "rxjs";
import { filter, map } from "rxjs/operators";
import { createRequiredArg } from "../src/arg";
import { createModel, createModelBase } from "../src/model";
import { createSelector } from "../src/selector";
import { createNyax } from "../src/store";

interface Dependencies {
  foo: string;
  bar: number;
}

export const dependencies: Dependencies = {
  foo: "foo",
  bar: 233,
};

const ModelBase = createModelBase<Dependencies>();

const FooModel = createModel(
  class extends ModelBase {
    public initialState() {
      return {
        foo: "foo",
        bar: 998,

        fooChangeCounter: 0,
      };
    }

    public selectors() {
      return {
        fooBar: () => this.state.foo + this.state.bar,
        cachedFooBar: createSelector(
          () => this.state.foo,
          () => this.state.bar,
          (foo, bar) => {
            new Array(2333333).forEach(() => {
              // wait
            });
            return foo + bar;
          }
        ),
      };
    }

    public reducers() {
      return {
        setFoo: (value: string) => {
          this.state.foo = value;
        },
        setBar: (value: number) => {
          this.state.bar = value;
        },
        increaseFooChangeCounter: () => {
          this.state.fooChangeCounter += 1;
        },
      };
    }

    public effects() {
      return {
        setFooAfter10ms: async (value: string) => {
          await timer(10).toPromise();
          await this.actions.setFoo.dispatch(value);
        },
        setFooAfter20ms: async (value: string) => {
          await timer(10).toPromise();
          await this.actions.setFooAfter10ms.dispatch(value);
        },
      };
    }

    public epics() {
      return {
        fooChangeCounter: () =>
          this.rootAction$.pipe(
            filter((action) => this.actions.setFoo.is(action)),
            map(() => this.actions.increaseFooChangeCounter.create({}))
          ),
      };
    }
  }
);

const BarModel = createModel(
  class extends ModelBase {
    public defaultArgs() {
      return {
        strArg: "str",
        numArg: 233,
        objArg: {
          foo: "foo",
          bar: 998,
        },
        requiredStrArg: createRequiredArg("requiredStr"),
      };
    }

    public initialState() {
      return {
        str: this.args.strArg,
        num: this.args.numArg,
        obj: this.args.objArg,
        requiredStr: this.args.requiredStrArg,
      };
    }

    public selectors() {
      return {
        strNum: () => this.state.str + this.state.num,
        cachedStrNum: createSelector(
          () => this.state.str,
          () => this.state.num,
          (str, num) => str + num
        ),
      };
    }

    public reducers() {
      return {
        setStr: (value: string) => {
          this.state.str = value;
        },
        setNum: (value: number) => {
          this.state.num = value;
        },
      };
    }

    public effects() {
      return {
        setStrAfter10ms: async (value: string) => {
          await timer(10).toPromise();
          await this.actions.setStr.dispatch(value);
        },
      };
    }
  },
  {
    isDynamic: true,
  }
);

describe("nyax", () => {
  it("test static model", async () => {
    let now = 0;

    const { store, getContainer, registerModels } = createNyax({
      dependencies,
    });
    registerModels({
      foo: FooModel,
    });

    expect(() => {
      getContainer(BarModel, "bar");
    }).throw();

    const foo = getContainer(FooModel);
    expect(foo.modelNamespace).eq("foo");
    expect(foo.containerKey).eq(undefined);
    expect(foo.canRegister).eq(false);
    expect(foo.isRegistered).eq(true);

    expect(foo.state.foo).eq("foo");
    expect(foo.state.bar).eq(998);

    foo.actions.setFoo.dispatch("fooo");
    expect(foo.state.foo).eq("fooo");

    foo.actions.setFooAfter10ms.dispatch("foo10");
    expect(foo.state.foo).eq("fooo");
    await timer(10).toPromise();
    expect(foo.state.foo).eq("foo10");

    await (async () => {
      const promise = foo.actions.setFooAfter20ms.dispatch("foo20");
      await timer(10).toPromise();
      expect(foo.state.foo).eq("foo10");
      await promise;
      expect(foo.state.foo).eq("foo20");
    })();

    expect(foo.getters.fooBar).eq("foo20998");
    store.dispatch(foo.actions.setBar.create(233));
    expect(foo.getters.fooBar).eq("foo20233");

    now = Date.now();
    expect(foo.getters.cachedFooBar, "foo20233");
    expect(Date.now() - now).gt(10);

    now = Date.now();
    expect(foo.getters.cachedFooBar, "foo20233");
    expect(Date.now() - now).lt(10);

    store.dispatch({
      type: "foo/setBar",
      payload: 666,
    });
    now = Date.now();
    expect(foo.getters.cachedFooBar, "foo20666");
    expect(Date.now() - now).gt(10);

    expect(foo.state.fooChangeCounter).eq(3);

    expect(() => {
      registerModels({
        bar: {
          foo: FooModel,
        },
      });
    }).throw();

    class BarFooModel extends FooModel {}
    registerModels({
      bar: {
        foo: BarFooModel,
      },
    });

    const barFoo = getContainer(BarFooModel);
    expect(barFoo.modelNamespace).eq("bar/foo");
    expect(barFoo.containerKey).eq(undefined);
    expect(barFoo.canRegister).eq(false);
    expect(barFoo.isRegistered).eq(true);

    expect(barFoo.getters.fooBar).eq("foo998");

    const BarLazyFooModel = createModel(class extends FooModel {}, {
      isLazy: true,
    });
    registerModels({
      bar: {
        lazy: {
          foo: BarLazyFooModel,
        },
      },
    });
    const barLazyFoo = getContainer(BarLazyFooModel);
    expect(barLazyFoo.modelNamespace).eq("bar/lazy/foo");
    expect(barLazyFoo.containerKey).eq(undefined);
    expect(barLazyFoo.canRegister).eq(true);
    expect(barLazyFoo.isRegistered).eq(false);

    expect(barLazyFoo.state.foo).eq("foo");
    expect(barLazyFoo.getters.cachedFooBar).eq("foo998");
    expect(barLazyFoo.isRegistered).eq(false);

    barLazyFoo.actions.setFoo.dispatch("for");
    expect(barLazyFoo.state.foo).eq("for");
    expect(barLazyFoo.getters.cachedFooBar).eq("for998");
    expect(barLazyFoo.isRegistered).eq(true);
  });

  it("test dynamic model", async () => {
    const { getContainer, registerModels } = createNyax({
      dependencies,
    });
    registerModels({
      bar: BarModel,
    });

    const barNyan = getContainer(BarModel, "nyan");
    expect(barNyan.modelNamespace).eq("bar");
    expect(barNyan.containerKey).eq("nyan");
    expect(barNyan.canRegister).eq(true);
    expect(barNyan.isRegistered).eq(false);

    expect(barNyan.state.str).eq("str");
    expect(barNyan.state.obj.bar).eq(998);
    expect(barNyan.state.requiredStr).eq("requiredStr");
    expect(barNyan.getters.strNum).eq("str233");
    expect(barNyan.isRegistered).eq(false);

    await (async () => {
      let resolved = false;
      const promise = barNyan.actions.setStr.dispatch("string");
      promise.then(() => {
        resolved = true;
      });
      await timer(10).toPromise();
      expect(resolved).eq(false);
    })();

    expect(() => {
      barNyan.register();
    }).throw();
    barNyan.unregister();

    barNyan.register({
      numArg: 123,
      requiredStrArg: "abc",
      objArg: {
        foo: "666",
        bar: 999,
      },
    });
    expect(barNyan.state.num).eq(123);
    expect(barNyan.state.requiredStr).eq("abc");
    expect(barNyan.state.obj).deep.eq({
      foo: "666",
      bar: 999,
    });
    expect(barNyan.canRegister).eq(false);
    expect(barNyan.isRegistered).eq(true);

    expect(barNyan.getters.cachedStrNum).eq("str123");
    barNyan.actions.setStr.dispatch("zzz");
    expect(barNyan.getters.cachedStrNum).eq("zzz123");

    const barMeow = getContainer(BarModel, "meow");
    expect(barMeow.state.str).eq("str");
    barMeow.register({
      strArg: "zrO",
      requiredStrArg: "Orz",
    });
    expect(barMeow.getters.cachedStrNum).eq("zrO233");
    expect(barNyan.getters.cachedStrNum).eq("zzz123");

    const TimerModel = createModel(
      class extends ModelBase {
        initialState() {
          return {
            time: 0,
          };
        }

        reducers() {
          return {
            setTime: (value: number) => {
              this.state.time = value;
            },
          };
        }
      }
    );
    const LazyBarModel = createModel(
      class extends BarModel {
        public epics() {
          return {
            0: () =>
              interval(3).pipe(
                map(() =>
                  this.getContainer(TimerModel).actions.setTime.create(
                    Date.now()
                  )
                )
              ),
          };
        }
      },
      {
        isDynamic: true,
        isLazy: true,
      }
    );
    registerModels({
      lazy: {
        bar: LazyBarModel,
      },
      timer: TimerModel,
    });

    let time = 0;
    const lazyBarZzz = getContainer(LazyBarModel, "zzz");
    const timerContainer = getContainer(TimerModel);
    await timer(10).toPromise();
    expect(timerContainer.state.time).eq(0);
    lazyBarZzz.register({
      requiredStrArg: "zzz",
    });
    await timer(10).toPromise();
    time = timerContainer.state.time;
    expect(time).not.eq(0);
    await timer(10).toPromise();
    expect(timerContainer.state.time).not.eq(time);
    time = timerContainer.state.time;
    lazyBarZzz.unregister();
    await timer(10).toPromise();
    expect(timerContainer.state.time).eq(time);
  });
});
