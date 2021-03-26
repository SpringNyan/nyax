import { NyaxContext } from "./context";
import {
  ExtractModelGetters,
  ModelDefinition,
  ModelDefinitionConstructor,
} from "./model";
import { concatLastString, defineGetter, mergeObjects } from "./util";

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

export function createGetters<TModel extends ModelDefinitionConstructor>(
  nyaxContext: NyaxContext,
  modelDefinition: ModelDefinition<TModel>
): ExtractModelGetters<TModel> {
  const getters: Record<string, unknown> = {};

  const fullNamespace = concatLastString(
    modelDefinition.namespace,
    modelDefinition.key
  );
  mergeObjects(
    getters,
    modelDefinition.selectors(),
    (_item, key, parent, paths) => {
      const fullPath = concatLastString(fullNamespace, paths.join("."));
      defineGetter(parent, key, () => {
        return nyaxContext.store.getComputed(fullPath);
      });
    }
  );

  return getters as ExtractModelGetters<TModel>;
}

// ok
