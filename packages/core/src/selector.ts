import {
  ConvertModelDefinitionGetters,
  ModelDefinition,
} from "./modelDefinition";
import { Nyax } from "./store";
import { defineGetter, mergeObjects } from "./util";

export type Selector<TResult = unknown, TValue = never> = [TValue] extends [
  never
]
  ? () => TResult
  : (value: TValue) => TResult;

export type ConvertGetters<TSelectors> = {
  [K in keyof TSelectors]: TSelectors[K] extends Selector<infer TResult>
    ? TResult
    : TSelectors[K] extends Selector<infer TResult, infer TValue>
    ? (value: TValue) => TResult
    : ConvertGetters<TSelectors[K]>;
};

export function createGetters<TModelDefinition extends ModelDefinition>(
  nyax: Nyax,
  modelDefinition: TModelDefinition,
  namespace: string,
  key: string | undefined
): ConvertModelDefinitionGetters<TModelDefinition> {
  const getters = {} as ConvertModelDefinitionGetters<TModelDefinition>;

  mergeObjects(
    getters,
    modelDefinition.selectors,
    function (item, k, target, paths) {
      const getterPath = paths.join(".");
      if (typeof item === "function" && item.length === 1) {
        target[k] = function (value: unknown) {
          return nyax.store.getModelComputed(namespace, key, getterPath, value);
        };
      } else {
        defineGetter(target, k, function () {
          return nyax.store.getModelComputed(namespace, key, getterPath);
        });
      }
    }
  );

  return getters;
}

// ok
