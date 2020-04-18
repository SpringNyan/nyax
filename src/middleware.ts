import { Middleware } from "redux";
import {
  AnyAction,
  batchRegisterActionHelper,
  batchUnregisterActionHelper,
  RegisterActionPayload,
  reloadActionHelper,
  ReloadActionPayload,
  UnregisterActionPayload,
} from "./action";
import { NyaxContext } from "./context";
import { createEpic } from "./epic";
import { isObject, joinLastString, splitLastString } from "./util";

export function createMiddleware(nyaxContext: NyaxContext): Middleware {
  function batchRegister(payloads: RegisterActionPayload[]): void {
    payloads.forEach((payload) => {
      const container = nyaxContext.getContainer(
        payload.modelNamespace,
        payload.containerKey
      );
      nyaxContext.containerByNamespace.set(container.namespace, container);

      const epic = createEpic(nyaxContext, container);
      nyaxContext.addEpic$.next(epic);
    });
  }

  function batchUnregister(payloads: UnregisterActionPayload[]): void {
    payloads.forEach((payload) => {
      const namespace = joinLastString(
        payload.modelNamespace,
        payload.containerKey
      );

      const container = nyaxContext.containerByNamespace.get(namespace);
      nyaxContext.containerByNamespace.delete(namespace);

      if (container) {
        nyaxContext.modelContextByModelConstructor
          .get(container.modelConstructor)
          ?.containerByContainerKey.delete(container.containerKey);
      }
    });
  }

  function reload(payload: ReloadActionPayload): void {
    nyaxContext.containerByNamespace.clear();

    nyaxContext.modelContextByModelConstructor.forEach((context) => {
      context.containerByContainerKey.clear();
    });

    nyaxContext.switchEpic$.next();

    const rootState =
      payload.state !== undefined
        ? payload.state
        : nyaxContext.store.getState();

    const registerPayloads: RegisterActionPayload[] = [];
    if (isObject(rootState)) {
      nyaxContext.modelContextByModelConstructor.forEach((context) => {
        const state = rootState[context.modelPath];
        if (isObject(state)) {
          if (!context.isDynamic) {
            registerPayloads.push({
              modelNamespace: context.modelNamespace,
            });
          } else {
            Object.keys(state).forEach((key) => {
              if (isObject(state[key])) {
                registerPayloads.push({
                  modelNamespace: context.modelNamespace,
                  containerKey: key,
                });
              }
            });
          }
        }
      });
    }

    batchRegister(registerPayloads);
  }

  return (store) => (next) => (action: AnyAction): AnyAction => {
    if (batchRegisterActionHelper.is(action)) {
      batchRegister(action.payload);
    } else if (batchUnregisterActionHelper.is(action)) {
      batchUnregister(action.payload);
    } else if (reloadActionHelper.is(action)) {
      reload(action.payload);
    }

    const result = next(action);

    const [namespace, actionName] = splitLastString(action.type);
    const container = nyaxContext.containerByNamespace.get(namespace);
    if (container?.isRegistered) {
      const deferred = nyaxContext.dispatchDeferredByAction.get(action);

      const effect = container.effectByPath[actionName];
      if (effect) {
        const promise = effect(action.payload);
        promise.then(
          (value) => {
            deferred?.resolve(value);
          },
          (reason) => {
            if (deferred) {
              deferred.reject(reason);
            } else {
              nyaxContext.onUnhandledEffectError(reason);
            }
          }
        );
      } else {
        deferred?.resolve(undefined);
      }
    }

    return result;
  };
}
