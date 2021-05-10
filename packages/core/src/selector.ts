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
  TModelDefinition extends ModelDefinitionConstructor
>(
  nyaxContext: NyaxContext,
  modelDefinitionInstance: InstanceType<TModelDefinition>
): ExtractModelDefinitionProperty<TModelDefinition, "getters"> {
  const getters: Record<string, unknown> = {};

  const modelPath = concatLastString(
    modelDefinitionInstance.namespace,
    modelDefinitionInstance.key
  );
  mergeObjects(
    getters,
    modelDefinitionInstance.selectors,
    (_item, key, parent, paths) => {
      const fullPath = concatLastString(modelPath, paths.join("."));
      defineGetter(parent, key, () => nyaxContext.store.getComputed(fullPath));
    }
  );

  return getters as ExtractModelDefinitionProperty<TModelDefinition, "getters">;
}

// ok3
