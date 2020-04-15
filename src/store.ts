import { Middleware, Reducer, Store } from "redux";
import { Epic } from "redux-observable";
import { GetContainer } from "./container";

export interface NyaxOptions {
  dependencies: any;

  createStore?: (context: {
    reducer: Reducer;
    epic: Epic;
    middleware: Middleware;
  }) => Store;

  onUnhandledEffectError?: (error: any) => void;
  onUnhandledEpicError?: (error: any) => void;
}

export interface Nyax {
  store: Store;
  getContainer: GetContainer;
}
