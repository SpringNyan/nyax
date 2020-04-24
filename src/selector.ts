import { ContainerImpl } from "./container";
import { ExtractGettersFromModel, Model } from "./model";
import { defineGetter, is, mergeObjects } from "./util";

export type ModelSelector<TResult = any> = () => TResult;

export interface ModelSelectors {
  [key: string]: ModelSelector | ModelSelectors;
}

export type ConvertGetters<TSelectors> = TSelectors extends infer TSelectors
  ? {
      [K in keyof TSelectors]: TSelectors[K] extends ModelSelector<
        infer TResult
      >
        ? TResult
        : ConvertGetters<TSelectors[K]>;
    }
  : never;

export interface SelectorCache {
  lastArgs?: any[];
  lastResult?: any;
}

export type InputSelector<TResult = any> = (lastResult?: TResult) => TResult;
export type OutputSelector<TResult = any> = (cache?: SelectorCache) => TResult;

export function createSelector<
  TSelectors extends Array<InputSelector> | [InputSelector],
  TResult
>(
  selectors: TSelectors,
  combiner: (
    results: {
      [K in Extract<keyof TSelectors, number>]: ReturnType<TSelectors[K]>;
    },
    lastResult?: TResult
  ) => TResult
): OutputSelector<TResult>;
export function createSelector<TResult>(
  combiner: (lastResult?: TResult) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, TResult>(
  selector1: InputSelector<T1>,
  combiner: (res1: T1, lastResult?: TResult) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  combiner: (res1: T1, res2: T2, lastResult?: TResult) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, T3, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  selector3: InputSelector<T3>,
  combiner: (res1: T1, res2: T2, res3: T3, lastResult?: TResult) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, T3, T4, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  selector3: InputSelector<T3>,
  selector4: InputSelector<T4>,
  combiner: (
    res1: T1,
    res2: T2,
    res3: T3,
    res4: T4,
    lastResult?: TResult
  ) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, T3, T4, T5, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  selector3: InputSelector<T3>,
  selector4: InputSelector<T4>,
  selector5: InputSelector<T5>,
  combiner: (
    res1: T1,
    res2: T2,
    res3: T3,
    res4: T4,
    res5: T5,
    lastResult?: TResult
  ) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, T3, T4, T5, T6, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  selector3: InputSelector<T3>,
  selector4: InputSelector<T4>,
  selector5: InputSelector<T5>,
  selector6: InputSelector<T6>,
  combiner: (
    res1: T1,
    res2: T2,
    res3: T3,
    res4: T4,
    res5: T5,
    res6: T6,
    lastResult?: TResult
  ) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, T3, T4, T5, T6, T7, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  selector3: InputSelector<T3>,
  selector4: InputSelector<T4>,
  selector5: InputSelector<T5>,
  selector6: InputSelector<T6>,
  selector7: InputSelector<T7>,
  combiner: (
    res1: T1,
    res2: T2,
    res3: T3,
    res4: T4,
    res5: T5,
    res6: T6,
    res7: T7,
    lastResult?: TResult
  ) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, T3, T4, T5, T6, T7, T8, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  selector3: InputSelector<T3>,
  selector4: InputSelector<T4>,
  selector5: InputSelector<T5>,
  selector6: InputSelector<T6>,
  selector7: InputSelector<T7>,
  selector8: InputSelector<T8>,
  combiner: (
    res1: T1,
    res2: T2,
    res3: T3,
    res4: T4,
    res5: T5,
    res6: T6,
    res7: T7,
    res8: T8,
    lastResult?: TResult
  ) => TResult
): OutputSelector<TResult>;
export function createSelector<T1, T2, T3, T4, T5, T6, T7, T8, T9, TResult>(
  selector1: InputSelector<T1>,
  selector2: InputSelector<T2>,
  selector3: InputSelector<T3>,
  selector4: InputSelector<T4>,
  selector5: InputSelector<T5>,
  selector6: InputSelector<T6>,
  selector7: InputSelector<T7>,
  selector8: InputSelector<T8>,
  selector9: InputSelector<T9>,
  combiner: (
    res1: T1,
    res2: T2,
    res3: T3,
    res4: T4,
    res5: T5,
    res6: T6,
    res7: T7,
    res8: T8,
    res9: T9,
    lastResult?: TResult
  ) => TResult
): OutputSelector<TResult>;
export function createSelector(...args: any[]): OutputSelector {
  const arrayMode = Array.isArray(args[0]);
  const selectors: InputSelector[] = arrayMode
    ? args[0]
    : args.slice(0, args.length - 1);
  const combiner: (...args: any[]) => any = args[args.length - 1];

  let defaultCache: SelectorCache | undefined;
  const outputSelector: OutputSelector = (cache) => {
    if (!cache) {
      if (!defaultCache) {
        defaultCache = {};
      }
      cache = defaultCache;
    }

    let shouldUpdate = !cache.lastArgs;

    const lastArgs = cache.lastArgs ?? [];
    const currArgs: any[] = [];
    for (let i = 0; i < selectors.length; ++i) {
      currArgs.push(selectors[i](lastArgs[i]));
      if (!shouldUpdate && !is(currArgs[i], lastArgs[i])) {
        shouldUpdate = true;
      }
    }

    cache.lastArgs = currArgs;
    if (shouldUpdate) {
      cache.lastResult = arrayMode
        ? combiner(currArgs, cache.lastResult)
        : combiner(...currArgs, cache.lastResult);
    }

    return cache.lastResult;
  };

  return outputSelector;
}

export function createGetters<TModel extends Model>(
  container: ContainerImpl<TModel>
): ExtractGettersFromModel<TModel> {
  const getters: Record<string, any> = {};
  const cacheByPath = new Map<string, SelectorCache>();

  mergeObjects(
    getters,
    container.selectors,
    (selector: OutputSelector, key, parent, paths) => {
      const path = paths.join(".");
      defineGetter(parent, key, () => {
        let cache = cacheByPath.get(path);
        if (!cache) {
          cache = {};
          cacheByPath.set(path, cache);
        }
        return selector(cache);
      });
    }
  );

  return getters as ExtractGettersFromModel<TModel>;
}
