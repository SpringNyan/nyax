import { ContainerImpl } from "./container";
import { AnyModel, ExtractModelGetters } from "./model";
import { defineGetter, is, mergeObjects } from "./util";

export type ModelSelector<TResult = unknown> = () => TResult;

export interface ModelSelectors {
  [key: string]: ModelSelector | ModelSelectors;
}

export interface AnyModelSelectors {
  [key: string]: ModelSelector<any> | AnyModelSelectors;
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
  lastDeps?: unknown[];
  lastResult?: unknown;
}

export type InputSelector<TResult> = (lastResult?: TResult) => TResult;
export type OutputSelector<TResult> = (cache?: SelectorCache) => TResult;

export function createSelector<
  TSelectors extends InputSelector<any>[] | [InputSelector<any>],
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
export function createSelector(...args: unknown[]): OutputSelector<unknown> {
  const arrayMode = Array.isArray(args[0]);
  const selectors = (arrayMode
    ? args[0]
    : args.slice(0, args.length - 1)) as InputSelector<unknown>[];
  const combiner = args[args.length - 1] as (...args: unknown[]) => unknown;

  let defaultCache: SelectorCache | undefined;
  const outputSelector: OutputSelector<unknown> = (cache) => {
    if (!cache) {
      if (!defaultCache) {
        defaultCache = {};
      }
      cache = defaultCache;
    }

    let shouldUpdate = !cache.lastDeps;

    const lastDeps = cache.lastDeps ?? [];
    const currDeps: unknown[] = [];
    for (let i = 0; i < selectors.length; ++i) {
      currDeps.push(selectors[i](lastDeps[i]));
      if (!shouldUpdate && !is(currDeps[i], lastDeps[i])) {
        shouldUpdate = true;
      }
    }

    cache.lastDeps = currDeps;
    if (shouldUpdate) {
      cache.lastResult = arrayMode
        ? combiner(currDeps, cache.lastResult)
        : combiner(...currDeps, cache.lastResult);
    }

    return cache.lastResult;
  };

  return outputSelector;
}

export function createGetters<TModel extends AnyModel>(
  container: ContainerImpl<TModel>
): ExtractModelGetters<TModel> {
  const getters: Record<string, unknown> = {};
  const cacheByPath = new Map<string, SelectorCache>();

  mergeObjects(getters, container.selectors, (selector, key, parent, paths) => {
    const path = paths.join(".");
    defineGetter(parent, key, () => {
      let cache = cacheByPath.get(path);
      if (!cache) {
        cache = {};
        cacheByPath.set(path, cache);
      }
      return (selector as OutputSelector<unknown>)(cache);
    });
  });

  return getters as ExtractModelGetters<TModel>;
}
