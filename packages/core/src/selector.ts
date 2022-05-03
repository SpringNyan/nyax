import { NyaxContext } from "./context";
import { Model } from "./model";
import {
  ConvertModelDefinitionGetters,
  ModelDefinitionBase,
} from "./modelDefinition";
import { defineGetter, mergeObjects } from "./util";

export type Selector<TResult = unknown> = () => TResult;

export type ConvertGetters<TSelectors> = {
  [K in keyof TSelectors]: TSelectors[K] extends Selector<infer TResult>
    ? TResult
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
    function (_item, k, target, paths) {
      const getterPath = paths.join(nyaxContext.options.pathSeparator);
      defineGetter(target, k, function () {
        return nyaxContext.store.getModelGetter(model, getterPath);
      });
    }
  );

  return getters;
}
