import { ExtractModelGetters, ModelBase } from "./model";
import { defineGetter, mergeObjects } from "./util";

export type ModelSelector<TResult = unknown> = () => TResult;

export interface ModelSelectors {
  [key: string]: ModelSelector | ModelSelectors;
}

export type ConvertGetters<TSelectors> = TSelectors extends any
  ? {
      [K in keyof TSelectors]: TSelectors[K] extends ModelSelector<
        infer TResult
      >
        ? TResult
        : ConvertGetters<TSelectors[K]>;
    }
  : never;

// ok

export function createGetters<TModel extends ModelConstructor>(
  modelInstance: InstanceType<TModel> & ModelBase
): ExtractModelGetters<TModel> {
  const getters: Record<string, unknown> = {};
  const cacheByPath = new Map<string, SelectorCache>();

  mergeObjects(
    getters,
    modelInstance.__nyax_selectors,
    (selector, key, parent, paths) => {
      const path = paths.join(".");
      defineGetter(parent, key, () => {
        let cache = cacheByPath.get(path);
        if (!cache) {
          cache = {};
          cacheByPath.set(path, cache);
        }
        return (selector as OutputSelector<unknown>)(cache);
      });
    }
  );

  return getters as ExtractModelGetters<TModel>;
}
