import { Model } from "./model";
import {
  ConvertModelDefinitionGetters,
  ModelDefinition,
} from "./modelDefinition";
import { Store } from "./store";
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
  store: Store,
  model: Model
): ConvertModelDefinitionGetters<TModelDefinition> {
  const getters = {} as ConvertModelDefinitionGetters<TModelDefinition>;

  mergeObjects(
    getters,
    model.modelDefinition.selectors,
    function (item, k, target, paths) {
      const getterPath = paths.join(".");
      if (typeof item === "function" && item.length === 1) {
        target[k] = function (value: unknown) {
          return store.getModelComputed(model, getterPath, value);
        };
      } else {
        defineGetter(target, k, function () {
          return store.getModelComputed(model, getterPath);
        });
      }
    }
  );

  return getters;
}
