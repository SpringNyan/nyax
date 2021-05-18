import { NyaxContext } from "./context";
import {
  ExtractModelDefinitionProperty,
  ModelDefinitionConstructor,
} from "./model";
import { concatLastString, defineGetter, mergeObjects } from "./util";

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

export function createGetters<
  TModelDefinitionConstructor extends ModelDefinitionConstructor
>(
  nyaxContext: NyaxContext,
  modelDefinition: InstanceType<TModelDefinitionConstructor>
): ExtractModelDefinitionProperty<TModelDefinitionConstructor, "getters"> {
  const getters: Record<string, unknown> = {};

  const modelPath = concatLastString(
    modelDefinition.namespace,
    modelDefinition.key
  );
  mergeObjects(
    getters,
    modelDefinition.selectors,
    (_item, key, parent, paths) => {
      const getterPath = concatLastString(modelPath, paths.join("."));
      defineGetter(parent, key, () =>
        nyaxContext.store.getComputed(getterPath)
      );
    }
  );

  return getters as ExtractModelDefinitionProperty<
    TModelDefinitionConstructor,
    "getters"
  >;
}
