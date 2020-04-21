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
    nyaxContext.switchEpic$.next();

    nyaxContext.containerByNamespace.clear();

    nyaxContext.modelContextByModelConstructor.forEach((context) => {
      context.containerByContainerKey.clear();
    });

    const rootState =
      payload.state !== undefined
        ? payload.state
        : nyaxContext.store.getState();

    const registerPayloads: RegisterActionPayload[] = [];
    if (isObject(rootState)) {
      nyaxContext.modelContextByModelConstructor.forEach(
        (context, modelConstructor) => {
          const state = rootState[context.modelPath];
          if (isObject(state)) {
            if (!modelConstructor.isDynamic && !modelConstructor.isLazy) {
              registerPayloads.push({
                modelNamespace: context.modelNamespace,
              });
            } else {
              Object.keys(state).forEach((containerKey) => {
                if (isObject(state[containerKey])) {
                  registerPayloads.push({
                    modelNamespace: context.modelNamespace,
                    containerKey,
                  });
                }
              });
            }
          }
        }
      );
    }

    batchRegister(registerPayloads);
  }

  return () => (next) => (action: AnyAction): AnyAction => {
    const dispatchDeferred = nyaxContext.dispatchDeferredByAction.get(action);
    nyaxContext.dispatchDeferredByAction.delete(action);

    if (batchRegisterActionHelper.is(action)) {
      batchRegister(action.payload);
    } else if (batchUnregisterActionHelper.is(action)) {
      batchUnregister(action.payload);
    } else if (reloadActionHelper.is(action)) {
      reload(action.payload);
    }

    const [namespace, actionName] = splitLastString(action.type);
    let container = nyaxContext.containerByNamespace.get(namespace);
    if (!container) {
      let modelNamespace = namespace;
      let containerKey: string | undefined;

      let modelConstructor = nyaxContext.modelConstructorByModelNamespace.get(
        modelNamespace
      );
      if (!modelConstructor) {
        [modelNamespace, containerKey] = splitLastString(modelNamespace);
        modelConstructor = nyaxContext.modelConstructorByModelNamespace.get(
          modelNamespace
        );
      }
      if (modelConstructor?.isLazy) {
        container = nyaxContext.getContainer(modelConstructor, containerKey);
        container.register();
      }
    }

    const result = next(action);

    if (container?.isRegistered) {
      const effect = container.effectByPath[actionName];
      if (effect) {
        const promise = effect(action.payload);
        promise.then(
          (value) => {
            if (dispatchDeferred) {
              dispatchDeferred.resolve(value);
            }
          },
          (reason) => {
            if (dispatchDeferred) {
              dispatchDeferred.reject(reason);
            } else {
              nyaxContext.onUnhandledEffectError(reason);
            }
          }
        );
      } else {
        if (dispatchDeferred) {
          dispatchDeferred.resolve(undefined);
        }
      }
    }

    return result;
  };
}
