import { AnyAction } from "./action";
import { Model } from "./model";

export interface Store {
  getState: () => unknown;
  dispatch: (action: AnyAction) => void;
  subscribe: (fn: () => void) => () => void;

  getComputed: (path: string) => unknown;
  registerModel: (model: Model) => void;
  unregisterModel: () => void;
}

export interface NyaxOptions {
  dependencies: unknown;
  store: Store;
}

export interface Nyax {
  store: Store;
}
