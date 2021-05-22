import { Model, ModelDefinitionClass } from "./model";
import { Nyax, NyaxOptions } from "./store";

export interface NyaxContext {
  nyax: Nyax;
  options: NyaxOptions;

  modelContextByNamespace: Map<string, ModelContext>;
}

export interface ModelContext {
  modelDefinitionClass: ModelDefinitionClass;
  modelByKey: Map<string | undefined, Model>;
}

export function createNyaxContext(options: NyaxOptions): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,
    options,

    modelContextByNamespace: new Map(),
  };

  return nyaxContext;
}
