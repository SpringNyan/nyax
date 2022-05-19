import {
  Action as ReduxAction,
  Dispatch as ReduxDispatch,
  Middleware as ReduxMiddleware,
} from "redux";
import {
  Action,
  ModelMountActionType,
  ModelUnmountActionType,
  ReloadActionPayload,
  ReloadActionType,
} from "./action";
import { NamespaceContext, NyaxContext } from "./context";
import { Model, ModelInternal } from "./model";
import { getModelState } from "./state";
import { splitLastString } from "./util";

export function createMiddleware(nyaxContext: NyaxContext): ReduxMiddleware {
  function mountModel(namespaceContext: NamespaceContext, model: Model) {
    const disposables: (() => void)[] = [];
    Object.values(namespaceContext.flattenedSubscriptions).forEach(
      (subscription) => {
        try {
          const disposable = subscription.call(model);
          if (disposable) {
            disposables.push(disposable);
          }
        } catch (error) {
          console.error(error);
        }
      }
    );
    namespaceContext.subscriptionDisposablesByKey.set(model.key, disposables);
  }

  function unmountModel(
    namespaceContext: NamespaceContext,
    model: Model,
    clear: boolean
  ) {
    const disposables = namespaceContext.subscriptionDisposablesByKey.get(
      model.key
    );
    disposables?.forEach((disposable) => {
      try {
        disposable();
      } catch (error) {
        console.error(error);
      }
    });

    (model as ModelInternal)._reset();

    if (clear) {
      namespaceContext.subscriptionDisposablesByKey.delete(model.key);

      if (model.key !== undefined) {
        namespaceContext.modelByKey.delete(model.key);
      } else {
        namespaceContext.model = undefined;
      }
    }
  }

  function mountNamespaceContext(namespaceContext: NamespaceContext) {
    const state = getModelState(
      nyaxContext.getRootState(),
      namespaceContext.namespace,
      undefined
    );
    if (state !== undefined) {
      if (namespaceContext.modelDefinition.isDynamic) {
        Object.keys(state).forEach((key) => {
          mountModel(
            namespaceContext,
            nyaxContext.nyax.getModel(namespaceContext.namespace, key)
          );
        });
      } else {
        mountModel(
          namespaceContext,
          nyaxContext.nyax.getModel(namespaceContext.namespace)
        );
      }
    }
  }

  function unmountNamespaceContext(namespaceContext: NamespaceContext) {
    if (namespaceContext.model) {
      unmountModel(namespaceContext, namespaceContext.model, false);
      namespaceContext.model = undefined;
    } else {
      namespaceContext.modelByKey.forEach((model) => {
        unmountModel(namespaceContext, model, false);
      });
      namespaceContext.modelByKey.clear();
    }
    namespaceContext.subscriptionDisposablesByKey.clear();
  }

  return function () {
    return function (next: ReduxDispatch) {
      return function (action: ReduxAction) {
        if (action.type === ReloadActionType) {
          const payload =
            (action as Action<ReloadActionPayload | undefined>).payload ?? {};
          const namespace =
            "namespace" in payload ? payload.namespace : undefined;

          if (namespace) {
            const namespaceContext =
              nyaxContext.namespaceContextByNamespace.get(namespace);
            if (namespaceContext) {
              unmountNamespaceContext(namespaceContext);
            }
          } else {
            nyaxContext.namespaceContextByNamespace.forEach(
              (namespaceContext) => {
                unmountNamespaceContext(namespaceContext);
              }
            );
          }

          const result = next(action);

          if (namespace) {
            const namespaceContext =
              nyaxContext.namespaceContextByNamespace.get(namespace);
            if (namespaceContext) {
              mountNamespaceContext(namespaceContext);
            }
          } else {
            nyaxContext.namespaceContextByNamespace.forEach(
              (namespaceContext) => {
                mountNamespaceContext(namespaceContext);
              }
            );
          }

          return result;
        }

        let model: Model | undefined;
        let actionType: string | undefined;
        let namespaceContext: NamespaceContext | undefined;
        if (nyaxContext.dispatchingAction === action) {
          model = nyaxContext.dispatchingModel;
          actionType = nyaxContext.dispatchingActionType;
        } else {
          let fullNamespace: string;
          [fullNamespace, actionType] = splitLastString(
            action.type,
            nyaxContext.options.namespaceSeparator
          );
          model = nyaxContext.tryGetModel(fullNamespace) ?? undefined;
        }

        if (model && actionType) {
          namespaceContext = nyaxContext.namespaceContextByNamespace.get(
            model.namespace
          );
          if (!namespaceContext) {
            throw new Error();
          }

          if (actionType === ModelUnmountActionType) {
            unmountModel(namespaceContext, model, true);
          } else if (actionType !== ModelMountActionType && !model.isMounted) {
            model.mount();
          }

          nyaxContext.dispatchingAction = action as Action;
          nyaxContext.dispatchingModel = model;
          nyaxContext.dispatchingActionType = actionType;
        }

        const result = next(action);

        if (actionType === ModelMountActionType && namespaceContext && model) {
          mountModel(namespaceContext, model);
        }

        nyaxContext.actionSubscribers.forEach((subscriber) => {
          try {
            subscriber(action);
          } catch (error) {
            console.error(error);
          }
        });

        if (model?.isMounted && actionType && namespaceContext) {
          const effect = namespaceContext.flattenedEffects[actionType];
          if (effect) {
            const effectResult = effect.call(model, (action as Action).payload);
            nyaxContext.dispatchingAction = action as Action;
            nyaxContext.dispatchingModel = model;
            nyaxContext.dispatchingActionType = actionType;
            nyaxContext.dispatchingResult = effectResult;
          }
        }

        return result;
      };
    };
  };
}
