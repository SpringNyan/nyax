import { expect } from "chai";
import { empty, interval, timer } from "rxjs";
import { filter, map, mergeMap } from "rxjs/operators";
import { createRequiredArg } from "../src/arg";
import { createSubContainer } from "../src/container";
import {
  createModel,
  createModelBase,
  mergeModels,
  mergeSubModels,
} from "../src/model";
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

describe("nyax", () => {
  it("test static model", async () => {
    let now = 0;

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

    const { store, getContainer, getState, registerModels } = createNyax({
      dependencies,
    });

    expect(() => {
      getContainer(FooModel);
    }).throw();

    registerModels({
      foo: FooModel,
    });

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

    expect(getState(FooModel)).eq(foo.state);
    expect(getState(FooModel)?.foo).eq(foo.state.foo);

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

    expect(getState(BarLazyFooModel)).eq(undefined);

    expect(barLazyFoo.state.foo).eq("foo");
    expect(barLazyFoo.getters.cachedFooBar).eq("foo998");
    expect(barLazyFoo.isRegistered).eq(false);

    barLazyFoo.actions.setFoo.dispatch("for");
    expect(barLazyFoo.state.foo).eq("for");
    expect(barLazyFoo.getters.cachedFooBar).eq("for998");
    expect(barLazyFoo.isRegistered).eq(true);

    expect(getState(BarLazyFooModel)).eq(barLazyFoo.state);
    expect(getState(BarLazyFooModel)?.foo).eq(barLazyFoo.state.foo);
  });

  it("test dynamic model", async () => {
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

    const { getContainer, getState, registerModels } = createNyax({
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

    expect(getState(BarModel)).eq(undefined);

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

    expect(getState(BarModel)?.nyan).eq(barNyan.state);
    expect(getState(BarModel)?.nyan?.str).eq(barNyan.state.str);
    expect(getState(BarModel, "nyan")).eq(barNyan.state);
    expect(getState(BarModel, "nyan")?.str).eq(barNyan.state.str);

    expect(getState(BarModel)?.meow).eq(undefined);
    expect(getState(BarModel, "meow")).eq(undefined);

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
        public initialState() {
          return {
            ...super.initialState(),
            lazy: true,
          };
        }

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
    expect(lazyBarZzz.state.str).eq("str");
    expect(lazyBarZzz.state.lazy).eq(true);
    const timerContainer = getContainer(TimerModel);
    await timer(10).toPromise();
    expect(timerContainer.state.time).eq(0);
    lazyBarZzz.register({
      requiredStrArg: "zzz",
    });

    expect(getState(LazyBarModel)?.zzz).eq(lazyBarZzz.state);

    await timer(10).toPromise();
    time = timerContainer.state.time;
    expect(time).not.eq(0);
    await timer(10).toPromise();
    expect(timerContainer.state.time).not.eq(time);
    time = timerContainer.state.time;
    lazyBarZzz.unregister();
    await timer(10).toPromise();
    expect(timerContainer.state.time).eq(time);

    expect(getState(LazyBarModel)?.zzz).eq(undefined);

    const RequiredArgWithoutDefaultValueModel = createModel(
      class extends ModelBase {
        public defaultArgs() {
          return {
            foo: createRequiredArg<string>(),
          };
        }

        public initialState() {
          return {
            foo: this.args.foo,
          };
        }
      },
      {
        isDynamic: true,
      }
    );
    registerModels({
      requiredArgWithoutDefaultValue: RequiredArgWithoutDefaultValueModel,
    });
    const requiredArgWithoutDefaultValueFoo = getContainer(
      RequiredArgWithoutDefaultValueModel,
      "foo"
    );
    expect(() => {
      requiredArgWithoutDefaultValueFoo.state.foo;
    }).throw();
    requiredArgWithoutDefaultValueFoo.unregister();
    requiredArgWithoutDefaultValueFoo.register({
      foo: "foo",
    });
    expect(requiredArgWithoutDefaultValueFoo.state.foo).eq("foo");
  });

  it("test merged model", async () => {
    const AModel = createModel(
      class extends ModelBase {
        public defaultArgs() {
          return {
            aArg: "a",
            foo: "foo",
          };
        }

        public initialState() {
          return {
            a: this.args.aArg,
            foo: this.args.foo,
            aStr: "aStr",
            aNum: 1,
            aStrChangeCounter: 0,
          };
        }

        public selectors() {
          return {
            aStrNum: () => this.state.aStr + this.state.aNum,
          };
        }

        public reducers() {
          return {
            setAStr: (value: string) => {
              this.state.aStr = value;
            },
            increaseAStrChangeCounter: () => {
              this.state.aStrChangeCounter += 1;
            },
          };
        }

        public effects() {
          return {
            setAStrAfter10ms: async (value: string) => {
              await timer(10).toPromise();
              await this.actions.setAStr.dispatch(value);
            },
          };
        }

        public epics() {
          return {
            a: () =>
              this.rootAction$.pipe(
                filter((action) => this.actions.setAStr.is(action)),
                map(() => this.actions.increaseAStrChangeCounter.create({}))
              ),
          };
        }
      }
    );

    const BModel = createModel(
      class extends ModelBase {
        public defaultArgs() {
          return {
            bArg: "b",
            bar: "bar",
          };
        }

        public initialState() {
          return {
            b: this.args.bArg,
            bar: this.args.bar,
            bStr: "bStr",
            bNum: 2,
            bStrChangeCounter: 0,
          };
        }

        public selectors() {
          return {
            bStrNum: () => this.state.bStr + this.state.bNum,
          };
        }

        public reducers() {
          return {
            setBStr: (value: string) => {
              this.state.bStr = value;
            },
            increaseBStrChangeCounter: () => {
              this.state.bStrChangeCounter += 1;
            },
          };
        }

        public effects() {
          return {
            setBStrAfter10ms: async (value: string) => {
              await timer(10).toPromise();
              await this.actions.setBStr.dispatch(value);
            },
          };
        }

        public epics() {
          return {
            b: () =>
              this.rootAction$.pipe(
                filter((action) => this.actions.setBStr.is(action)),
                map(() => this.actions.increaseBStrChangeCounter.create({}))
              ),
          };
        }
      }
    );

    const { getContainer, getState, registerModels } = createNyax({
      dependencies,
    });

    const ABModel = mergeModels(AModel, BModel);

    registerModels({
      ab: ABModel,
    });
    const ab = getContainer(ABModel);
    expect(ab.state.a).eq("a");
    expect(ab.state.b).eq("b");

    ab.actions.setAStr.dispatch("aa");
    expect(ab.state.aStr).eq("aa");
    expect(ab.getters.aStrNum).eq("aa1");
    expect(ab.state.bStr).eq("bStr");
    expect(ab.getters.bStrNum).eq("bStr2");

    expect(getState(ABModel)?.aStr).eq(ab.state.aStr);

    await ab.actions.setBStrAfter10ms.dispatch("bb");
    expect(ab.getters.bStrNum).eq("bb2");

    expect(ab.state.aStrChangeCounter).eq(1);
    expect(ab.state.bStrChangeCounter).eq(1);

    const ABSubABModel = createModel(
      mergeModels(
        AModel,
        BModel,
        mergeSubModels({
          subA: AModel,
          subB: BModel,
        })
      ),
      {
        isDynamic: true,
        isLazy: true,
      }
    );
    registerModels({
      spring: {
        nyan: ABSubABModel,
      },
    });
    const abSubABMeow = getContainer(ABSubABModel, "meow");
    expect(abSubABMeow.modelNamespace).eq("spring/nyan");
    expect(abSubABMeow.containerKey).eq("meow");
    expect(abSubABMeow.canRegister).eq(true);
    expect(abSubABMeow.isRegistered).eq(false);

    expect(abSubABMeow.state.aNum).eq(1);
    expect(abSubABMeow.state.foo).eq("foo");
    expect(abSubABMeow.state.bNum).eq(2);
    expect(abSubABMeow.state.bar).eq("bar");
    expect(abSubABMeow.state.subA.aStr).eq("aStr");
    expect(abSubABMeow.state.subB.bStr).eq("bStr");

    abSubABMeow.register({
      aArg: "aa",
      bar: "boom",
      subA: {
        foo: "for",
      },
    });
    expect(abSubABMeow.state.foo).eq("foo");
    expect(abSubABMeow.state.bar).eq("boom");
    expect(abSubABMeow.state.subA.foo).eq("for");
    expect(abSubABMeow.state.subA.a).eq("a");
    expect(abSubABMeow.state.subB.bar).eq("bar");
    expect(abSubABMeow.state.subB.b).eq("b");

    expect(getState(ABSubABModel)?.meow?.subA).eq(abSubABMeow.state.subA);

    const subA = createSubContainer(abSubABMeow, "subA");
    const subB = createSubContainer(abSubABMeow, "subB");

    expect(subA.state.foo).eq("for");
    expect(subA.getters.aStrNum).eq("aStr1");

    await subB.actions.setBStrAfter10ms.dispatch("bbb");
    expect(subB.getters.bStrNum).eq("bbb2");
    expect(abSubABMeow.state.subB.bStrChangeCounter).eq(1);

    expect(subA.actions.setAStr.create("aaa")).deep.eq({
      type: "spring/nyan/meow/subA.setAStr",
      payload: "aaa",
    });
  });

  it("test unhandled error", async () => {
    let okCounter = 0;
    let effectErrorCounter = 0;
    let effectCatchedCounter = 0;
    let epicErrorCounter = 0;

    const ErrorModel = createModel(
      class extends ModelBase {
        public reducers() {
          return {
            ok: () => {
              return;
            },
            epic: () => {
              return;
            },
          };
        }

        public effects() {
          return {
            effect: async () => {
              await timer(5).toPromise();
              throw new Error("effect error");
            },
            effect2: async () => {
              await timer(5).toPromise();
              await this.actions.effect.dispatch({});
            },
            effect3: async () => {
              await timer(5).toPromise();
              await this.actions.effect2.dispatch({});
            },
            effectCatchInner: async () => {
              await timer(5).toPromise();
              try {
                await this.actions.effect.dispatch({});
              } catch {
                // noop
              }
            },
          };
        }

        public epics() {
          return {
            0: () =>
              this.rootAction$.pipe(
                filter((action) => this.actions.epic.is(action)),
                map(() => {
                  throw new Error("epic error");
                })
              ),
            1: () =>
              this.rootAction$.pipe(
                filter((action) => this.actions.ok.is(action)),
                mergeMap(() => {
                  okCounter += 1;
                  return empty();
                })
              ),
          };
        }
      }
    );

    const { getContainer, registerModels } = createNyax({
      dependencies,
      onUnhandledEffectError: (error, promise) => {
        promise?.catch(() => {
          // noop
        });
        expect(error.message).eq("effect error");
        effectErrorCounter += 1;
      },
      onUnhandledEpicError: (error, caught) => {
        expect(error.message).eq("epic error");
        epicErrorCounter += 1;
        return caught;
      },
    });

    registerModels({
      err: ErrorModel,
    });

    const err = getContainer(ErrorModel);
    err.actions.ok.dispatch({});
    expect(okCounter).eq(1);
    err.actions.epic.dispatch({});
    expect(epicErrorCounter).eq(1);
    err.actions.ok.dispatch({});
    expect(okCounter).eq(2);
    err.actions.epic.dispatch({});
    expect(epicErrorCounter).eq(2);

    err.actions.effect.dispatch({}).then(
      () => {
        // noop
      },
      () => {
        // noop
      }
    );
    expect(effectErrorCounter).eq(0);

    err.actions.effect.dispatch({}).catch(() => {
      // noop
    });
    expect(effectErrorCounter).eq(0);

    err.actions.effect
      .dispatch({})
      .then(() => {
        // noop
      })
      .catch(() => {
        // noop
      });
    await timer(50).toPromise();
    expect(effectErrorCounter).eq(1);
    expect(effectCatchedCounter).eq(0);

    try {
      await err.actions.effect.dispatch({});
    } catch {
      effectCatchedCounter += 1;
    }
    await timer(50).toPromise();
    expect(effectErrorCounter).eq(1);
    expect(effectCatchedCounter).eq(1);

    err.actions.effect2.dispatch({});
    await timer(50).toPromise();
    expect(effectErrorCounter).eq(2);
    expect(effectCatchedCounter).eq(1);

    try {
      await err.actions.effect2.dispatch({});
    } catch {
      effectCatchedCounter += 1;
    }
    await timer(50).toPromise();
    expect(effectErrorCounter).eq(2);
    expect(effectCatchedCounter).eq(2);

    err.actions.effect3
      .dispatch({})
      .then(() => {
        // noop
      })
      .catch(() => {
        // noop
      });
    await timer(50).toPromise();
    expect(effectErrorCounter).eq(3);
    expect(effectCatchedCounter).eq(2);

    try {
      await err.actions.effect3.dispatch({});
    } catch {
      effectCatchedCounter += 1;
    }
    await timer(50).toPromise();
    expect(effectErrorCounter).eq(3);
    expect(effectCatchedCounter).eq(3);

    err.actions.effectCatchInner.dispatch({});
    await timer(50).toPromise();
    expect(effectErrorCounter).eq(3);
  });
});
