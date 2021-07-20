import { createActionHelpers } from "./action";
import { Container } from "./container";
import { Model, ModelBase, ModelClass, NamespacedModelClass } from "./model";
import { createGetters } from "./selector";
import { Nyax, NyaxOptions } from "./store";

export interface NyaxContext {
  nyax: Nyax;
  options: NyaxOptions;

  modelClassContextByNamespace: Map<string, ModelClassContext>;

  getModelClassContext(
    modelClassOrNamespace: NamespacedModelClass | string
  ): ModelClassContext;

  getModel(namespace: string, key: string | undefined): Model | null;
  deleteModel(namespace: string, key: string | undefined): void;
}

export interface ModelClassContext {
  modelClass: NamespacedModelClass;

  modelByKey: Map<string | undefined, Model>;
  containerByKey: Map<string | undefined, Container>;
}

export function createNyaxContext(options: NyaxOptions): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,
    options,

    modelClassContextByNamespace: new Map(),

    getModelClassContext(modelClassOrNamespace) {
      const namespace =
        typeof modelClassOrNamespace === "string"
          ? modelClassOrNamespace
          : modelClassOrNamespace.namespace;

      let modelClassContext =
        nyaxContext.modelClassContextByNamespace.get(namespace);
      if (!modelClassContext) {
        if (typeof modelClassOrNamespace !== "string") {
          modelClassContext = {
            modelClass: modelClassOrNamespace,
            modelByKey: new Map(),
            containerByKey: new Map(),
          };
          nyaxContext.modelClassContextByNamespace.set(
            namespace,
            modelClassContext
          );
        } else {
          throw new Error("Model class is not registered.");
        }
      }

      if (
        typeof modelClassOrNamespace !== "string" &&
        modelClassContext.modelClass !== modelClassOrNamespace
      ) {
        throw new Error("Model class is not matched.");
      }

      return modelClassContext;
    },

    getModel(namespace, key) {
      const modelClassContext =
        nyaxContext.modelClassContextByNamespace.get(namespace);
      if (!modelClassContext) {
        return null;
      }

      let model = modelClassContext.modelByKey.get(key) as
        | ModelBase
        | undefined;
      if (!model) {
        let getters: any;
        let actions: any;

        model =
          new (modelClassContext.modelClass as ModelClass as typeof ModelBase)({
            nyax: nyaxContext.nyax,

            namespace,
            key,

            get state() {
              return nyaxContext.nyax.store.getModelState(namespace, key);
            },
            get getters() {
              if (!getters && model) {
                getters = createGetters(nyaxContext.nyax, model);
              }
              return getters;
            },
            get actions() {
              if (!actions && model) {
                actions = createActionHelpers(nyaxContext.nyax, model);
              }
              return actions;
            },
          });
        modelClassContext.modelByKey.set(key, model);
      }

      return model;
    },
    deleteModel(namespace, key) {
      nyaxContext.modelClassContextByNamespace
        .get(namespace)
        ?.modelByKey.delete(key);
    },
  };

  return nyaxContext;
}
