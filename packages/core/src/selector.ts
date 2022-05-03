import { NyaxContext } from "./context";
import { Model } from "./model";
import {
  ConvertModelDefinitionGetters,
  ModelDefinitionBase,
} from "./modelDefinition";
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

export function createGetters<TModelDefinition extends ModelDefinitionBase>(
  nyaxContext: NyaxContext,
  model: Model
): ConvertModelDefinitionGetters<TModelDefinition> {
  const getters = {} as ConvertModelDefinitionGetters<TModelDefinition>;

  mergeObjects(
    getters,
    model.modelDefinition.selectors,
    function (item, k, target, paths) {
      const getterPath = paths.join(nyaxContext.options.pathSeparator);
      if (typeof item === "function" && item.length === 1) {
        target[k] = function (value: unknown) {
          return nyaxContext.store.getModelGetter(model, getterPath, value);
        };
      } else {
        defineGetter(target, k, function () {
          return nyaxContext.store.getModelGetter(model, getterPath);
        });
      }
    }
  );

  return getters;
}
