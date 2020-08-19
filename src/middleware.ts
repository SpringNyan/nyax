import { Middleware } from "redux";
import {
  Action,
  AnyAction,
  batchActionHelper,
  RegisterActionPayload,
  reloadActionHelper,
  ReloadActionPayload,
  UnregisterActionPayload,
} from "./action";
import { NyaxContext } from "./context";
import { createEpic } from "./epic";
import { isObject, joinLastString, splitLastString } from "./util";

export function createMiddleware(nyaxContext: NyaxContext): Middleware {
  function register(payload: RegisterActionPayload): void {
    const container = nyaxContext.getContainer(
      payload.modelNamespace,
      payload.containerKey
    );
    nyaxContext.containerByNamespace.set(container.namespace, container);

    const epic = createEpic(nyaxContext, container);
    nyaxContext.addEpic$.next(epic);
  }

  function unregister(payload: UnregisterActionPayload): void {
    const namespace = joinLastString(
      payload.modelNamespace,
      payload.containerKey
    );

    const container = nyaxContext.containerByNamespace.get(namespace);
    nyaxContext.containerByNamespace.delete(namespace);

    if (container) {
      container.modelContext.containerByContainerKey.delete(
        container.containerKey
      );

      container.modelContext.stopEpicEmitterByContainerKey.get(
        container.containerKey
      )?.();
      container.modelContext.stopEpicEmitterByContainerKey.delete(
        container.containerKey
      );
    }
  }

  function reload(payload: ReloadActionPayload): void {
    nyaxContext.switchEpic$.next();

    nyaxContext.containerByNamespace.clear();

    nyaxContext.modelContextByModel.forEach((context) => {
      context.containerByContainerKey.clear();
      context.stopEpicEmitterByContainerKey.clear();
    });

    const rootState = nyaxContext.rootReducer(
      nyaxContext.store.getState(),
      reloadActionHelper.create(payload)
    );

    const registerActionPayloads: RegisterActionPayload[] = [];
    if (isObject(rootState)) {
      nyaxContext.modelContextByModel.forEach((context, model) => {
        const state = rootState[context.modelPath];
        if (isObject(state)) {
          if (!model.isDynamic) {
            registerActionPayloads.push({
              modelNamespace: context.modelNamespace,
            });
          } else {
            Object.keys(state).forEach((containerKey) => {
              if (isObject(state[containerKey])) {
                registerActionPayloads.push({
                  modelNamespace: context.modelNamespace,
                  containerKey,
                });
              }
            });
          }
        }
      });
    }

    registerActionPayloads.forEach((payload) => {
      register(payload);
    });
  }

  function commitBatchActions() {
    const actions = nyaxContext.batchCommitActions;

    nyaxContext.batchCommitTime = null;
    nyaxContext.batchCommitTimeoutId = null;
    nyaxContext.batchCommitActions = [];

    nyaxContext.store.dispatch(
      batchActionHelper.create({
        actions,
      })
    );
  }

  return () => (next) => (action: AnyAction): AnyAction => {
    let actions = [action];

    if (batchActionHelper.is(action)) {
      const { actions, timeout } = action.payload;
      const batchContext = nyaxContext.batchContext;

      if (timeout !== undefined) {
        batchContext.actions.push(...actions);
        if (timeout == null) {
          commitBatchActions();
        } else {
          const commitTime = Date.now() + timeout;
          if (
            batchContext.commitTime == null ||
            commitTime < batchContext.commitTime
          ) {
            batchContext.commitTime = commitTime;
            if (batchContext.timeoutId != null) {
              clearTimeout(batchContext.timeoutId);
            }
            batchContext.timeoutId = setTimeout(() => {
              commitBatchActions();
            }, timeout);
          }
        }
      } else {
        actions = action.payload.actions;
      }
    }

    const dispatchDeferred = nyaxContext.dispatchDeferredByAction.get(action);
    nyaxContext.dispatchDeferredByAction.delete(action);

    if (batchRegisterActionHelper.is(action)) {
      register(action.payload);
    } else if (batchUnregisterActionHelper.is(action)) {
      unregister(action.payload);
    } else if (reloadActionHelper.is(action)) {
      reload(action.payload);
    }

    const [namespace, actionName] = splitLastString(action.type);
    let container = nyaxContext.containerByNamespace.get(namespace);
    if (!container) {
      let modelNamespace = namespace;
      let containerKey: string | undefined;

      let modelContext = nyaxContext.modelContextByModelNamespace.get(
        modelNamespace
      );
      if (!modelContext) {
        [modelNamespace, containerKey] = splitLastString(modelNamespace);
        modelContext = nyaxContext.modelContextByModelNamespace.get(
          modelNamespace
        );
      }

      const model = modelContext?.model;
      if (model?.isOnDemand || model?.isLazy) {
        container = nyaxContext.getContainer(model, containerKey);
        container.register();
      }
    }

    const result = next(action);

    if (container?.isRegistered) {
      const effect = container.effectByPath[actionName];
      if (effect) {
        const promise = effect((action as Action).payload);
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
              nyaxContext.onUnhandledEffectError(reason, undefined);
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
