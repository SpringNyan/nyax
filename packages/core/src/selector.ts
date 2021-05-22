import {
  ExtractModelDefinitionProperty,
  ModelDefinitionConstructor,
} from "./model";
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

export function createGetters<
  TModelDefinitionConstructor extends ModelDefinitionConstructor
>(
  nyax: Nyax,
  modelDefinition: InstanceType<TModelDefinitionConstructor>
): ExtractModelDefinitionProperty<TModelDefinitionConstructor, "getters"> {
  const getters: Record<string, unknown> = {};

  mergeObjects(
    getters,
    modelDefinition.selectors,
    (_item, key, parent, paths) => {
      const getterPath = paths.join(".");
      defineGetter(parent, key, () =>
        nyax.store.getModelComputed(
          modelDefinition.namespace,
          modelDefinition.key,
          getterPath
        )
      );
    }
  );

  return getters as ExtractModelDefinitionProperty<
    TModelDefinitionConstructor,
    "getters"
  >;
}
