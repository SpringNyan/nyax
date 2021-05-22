import {
  Model,
  ModelDefinition,
  ModelDefinitionBase,
  ModelDefinitionClass,
} from "./model";
import { Nyax, NyaxOptions } from "./store";

export interface NyaxContext {
  nyax: Nyax;
  options: NyaxOptions;

  modelContextByNamespace: Map<string, ModelContext>;

  getModelContext(
    modelDefinitionClassOrNamespace: ModelDefinitionClass | string
  ): ModelContext;

  getModelDefinition(
    namespace: string,
    key: string | undefined
  ): ModelDefinition | null;
  deleteModelDefinition(namespace: string, key: string | undefined): void;
}

export interface ModelContext {
  modelDefinitionClass: ModelDefinitionClass;

  modelDefinitionByKey: Map<string | undefined, ModelDefinition>;
  modelByKey: Map<string | undefined, Model>;
}

export function createNyaxContext(options: NyaxOptions): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,
    options,

    modelContextByNamespace: new Map(),

    getModelContext(modelDefinitionClassOrNamespace) {
      const namespace =
        typeof modelDefinitionClassOrNamespace === "string"
          ? modelDefinitionClassOrNamespace
          : modelDefinitionClassOrNamespace.namespace;

      let modelContext = nyaxContext.modelContextByNamespace.get(namespace);
      if (!modelContext) {
        if (typeof modelDefinitionClassOrNamespace !== "string") {
          modelContext = {
            modelDefinitionClass: modelDefinitionClassOrNamespace,
            modelByKey: new Map(),
            modelDefinitionByKey: new Map(),
          };
          nyaxContext.modelContextByNamespace.set(namespace, modelContext);
        } else {
          throw new Error("Model definition class is not registered.");
        }
      }

      if (
        typeof modelDefinitionClassOrNamespace !== "string" &&
        modelContext.modelDefinitionClass !== modelDefinitionClassOrNamespace
      ) {
        throw new Error("Model definition class is not matched.");
      }

      return modelContext;
    },

    getModelDefinition(namespace, key) {
      const modelContext = nyaxContext.modelContextByNamespace.get(namespace);
      if (!modelContext) {
        return null;
      }

      let modelDefinition = modelContext.modelDefinitionByKey.get(key) as
        | ModelDefinitionBase
        | undefined;
      if (!modelDefinition) {
        modelDefinition = new modelContext.modelDefinitionClass() as ModelDefinitionBase;
        modelDefinition.__nyax_nyax = nyaxContext.nyax;
        modelDefinition.__nyax_modelNamespace = namespace;
        modelDefinition.__nyax_modelKey = key;
        modelContext.modelDefinitionByKey.set(key, modelDefinition);
      }

      return modelDefinition;
    },
    deleteModelDefinition(namespace, key) {
      nyaxContext.modelContextByNamespace
        .get(namespace)
        ?.modelDefinitionByKey.delete(key);
    },
  };

  return nyaxContext;
}
