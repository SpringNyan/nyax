import { ExtractContainerProperty } from "./container";
import { ModelClass } from "./model";
import { Nyax } from "./store";
import { defineGetter, mergeObjects } from "./util";

export type Selector<TResult = unknown> = () => TResult;

export interface Selectors {
  [key: string]: Selector | Selectors;
}

export type ConvertGetters<TSelectors> = TSelectors extends any
  ? {
      [K in keyof TSelectors]: TSelectors[K] extends Selector<infer TResult>
        ? TResult
        : ConvertGetters<TSelectors[K]>;
    }
  : never;

export function createGetters<TModelClass extends ModelClass>(
  nyax: Nyax,
  model: InstanceType<TModelClass>
): ExtractContainerProperty<TModelClass, "getters"> {
  const getters: Record<string, unknown> = {};

  mergeObjects(getters, model.selectors(), (_item, key, parent, paths) => {
    const getterPath = paths.join(".");
    defineGetter(parent, key, () =>
      nyax.store.getModelComputed(model.namespace, model.key, getterPath)
    );
  });

  return getters as ExtractContainerProperty<TModelClass, "getters">;
}
