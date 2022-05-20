import {
  ActionHelper,
  ConvertActionHelpers,
  ModelMountActionPayload,
  ModelMountActionType,
  ModelPatchActionPayload,
  ModelPatchActionType,
  ModelSetActionPayload,
  ModelSetActionType,
  ModelUnmountActionPayload,
  ModelUnmountActionType,
} from "./action";
import { GetModel } from "./model";
import { ConvertGetters, CreateSelector } from "./selector";
import { Nyax } from "./store";
import { mergeObjects } from "./util";

type ModelDefinitionBuildInActionHelpers<
  TState extends Record<string, unknown>
> = {
  [ModelMountActionType]: ActionHelper<ModelMountActionPayload<TState>>;
  [ModelUnmountActionType]: ActionHelper<ModelUnmountActionPayload>;
  [ModelSetActionType]: ActionHelper<ModelSetActionPayload<TState>>;
  [ModelPatchActionType]: ActionHelper<ModelPatchActionPayload<TState>>;
};

export interface ModelDefinitionBase<
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {},
  TSubscriptions extends Record<string, unknown> = {}
> {
  state(): TState;
  selectors: TSelectors;
  reducers: TReducers;
  effects: TEffects;
  subscriptions: TSubscriptions;
}

export interface ModelDefinition<
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {},
  TSubscriptions extends Record<string, unknown> = {},
  TDynamic extends boolean = boolean
> extends ModelDefinitionBase<
    TState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  > {
  namespace: string;
  isDynamic: TDynamic;
}

export type ExtractModelDefinitionState<
  TModelDefinition extends ModelDefinitionBase
> = TModelDefinition extends ModelDefinitionBase<infer T, any, any, any, any>
  ? T
  : never;
export type ExtractModelDefinitionSelectors<
  TModelDefinition extends ModelDefinitionBase
> = TModelDefinition extends ModelDefinitionBase<any, infer T, any, any, any>
  ? T
  : never;
export type ExtractModelDefinitionReducers<
  TModelDefinition extends ModelDefinitionBase
> = TModelDefinition extends ModelDefinitionBase<any, any, infer T, any, any>
  ? T
  : never;
export type ExtractModelDefinitionEffects<
  TModelDefinition extends ModelDefinitionBase
> = TModelDefinition extends ModelDefinitionBase<any, any, any, infer T, any>
  ? T
  : never;
export type ExtractModelDefinitionSubscriptions<
  TModelDefinition extends ModelDefinitionBase
> = TModelDefinition extends ModelDefinitionBase<any, any, any, any, infer T>
  ? T
  : never;

export type ConvertModelDefinitionState<
  TModelDefinition extends ModelDefinitionBase
> = ExtractModelDefinitionState<TModelDefinition>;
export type ConvertModelDefinitionGetters<
  TModelDefinition extends ModelDefinitionBase
> = ConvertGetters<ExtractModelDefinitionSelectors<TModelDefinition>>;
export type ConvertModelDefinitionActionHelpers<
  TModelDefinition extends ModelDefinitionBase
> = ConvertActionHelpers<
  ExtractModelDefinitionReducers<TModelDefinition>,
  ExtractModelDefinitionEffects<TModelDefinition>
> &
  ModelDefinitionBuildInActionHelpers<
    ConvertModelDefinitionState<TModelDefinition>
  >;

export interface CreateModelDefinitionContext<
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {}
> {
  state: TState;
  getters: ConvertGetters<TSelectors>;
  actions: ConvertActionHelpers<TReducers, TEffects> &
    ModelDefinitionBuildInActionHelpers<TState>;

  namespace: string;
  key: string | undefined;
  fullNamespace: string;

  isMounted: boolean;

  getModel: GetModel;
  createSelector: CreateSelector;
  nyax: Nyax;
}

type CreateModelDefinitionOptions<
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {},
  TSubscriptions extends Record<string, unknown> = {}
> = {
  state?(): TState;
  selectors?: TSelectors;
  reducers?: TReducers;
  effects?: TEffects;
  subscriptions?: TSubscriptions;
} & ThisType<
  CreateModelDefinitionContext<TState, TSelectors, TReducers, TEffects>
>;

type ExtendModelDefinitionOptions<
  TBaseModelDefinition extends ModelDefinitionBase = ModelDefinitionBase,
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {},
  TSubscriptions extends Record<string, unknown> = {}
> = {
  state?(): TState;
  selectors?: TSelectors;
  reducers?: TReducers;
  effects?: TEffects;
  subscriptions?: TSubscriptions;
} & ThisType<
  CreateModelDefinitionContext<
    ExtractModelDefinitionState<TBaseModelDefinition> & TState,
    ExtractModelDefinitionSelectors<TBaseModelDefinition> & TSelectors,
    ExtractModelDefinitionReducers<TBaseModelDefinition> & TReducers,
    ExtractModelDefinitionEffects<TBaseModelDefinition> & TEffects
  >
>;

export function createModelDefinition<
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {},
  TSubscriptions extends Record<string, unknown> = {}
>(
  options: CreateModelDefinitionOptions<
    TState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  >
): ModelDefinitionBase<TState, TSelectors, TReducers, TEffects, TSubscriptions>;
export function createModelDefinition<
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {},
  TSubscriptions extends Record<string, unknown> = {},
  TDynamic extends boolean = false
>(
  namespace: string,
  options: CreateModelDefinitionOptions<
    TState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  >,
  isDynamic?: TDynamic
): ModelDefinition<
  TState,
  TSelectors,
  TReducers,
  TEffects,
  TSubscriptions,
  TDynamic
>;
export function createModelDefinition(...args: unknown[]): ModelDefinitionBase {
  const hasNamespace = typeof args[0] === "string";
  const options = (
    hasNamespace ? args[1] : args[0]
  ) as CreateModelDefinitionOptions;

  const modelDefinitionBase: ModelDefinitionBase = {
    state:
      options.state ??
      function () {
        return {};
      },
    selectors: options.selectors ?? {},
    reducers: options.reducers ?? {},
    effects: options.effects ?? {},
    subscriptions: options.subscriptions ?? {},
  };

  if (hasNamespace) {
    const modelDefinition = modelDefinitionBase as ModelDefinition;
    modelDefinition.namespace = args[0] as string;
    modelDefinition.isDynamic = (args[2] ?? false) as boolean;
  }

  return modelDefinitionBase;
}

export function extendModelDefinition<
  TBaseModelDefinition extends ModelDefinitionBase = ModelDefinitionBase,
  TState extends Record<string, unknown> = {},
  TSelectors extends Record<string, unknown> = {},
  TReducers extends Record<string, unknown> = {},
  TEffects extends Record<string, unknown> = {},
  TSubscriptions extends Record<string, unknown> = {}
>(
  baseModelDefinition: TBaseModelDefinition,
  options: ExtendModelDefinitionOptions<
    TBaseModelDefinition,
    TState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  >
): ModelDefinitionBase<
  ExtractModelDefinitionState<TBaseModelDefinition> & TState,
  ExtractModelDefinitionSelectors<TBaseModelDefinition> & TSelectors,
  ExtractModelDefinitionReducers<TBaseModelDefinition> & TReducers,
  ExtractModelDefinitionEffects<TBaseModelDefinition> & TEffects,
  ExtractModelDefinitionSubscriptions<TBaseModelDefinition> & TSubscriptions
> {
  const modelDefinition: ModelDefinitionBase = {
    state() {
      return {
        ...baseModelDefinition.state.call(this),
        ...options.state?.call(this),
      };
    },
    selectors: {
      ...baseModelDefinition.selectors,
      ...options.selectors,
    },
    reducers: {
      ...baseModelDefinition.reducers,
      ...options.reducers,
    },
    effects: {
      ...baseModelDefinition.effects,
      ...options.effects,
    },
    subscriptions: {
      ...baseModelDefinition.subscriptions,
      ...options.subscriptions,
    },
  };
  return modelDefinition as any;
}

const subDefineModelContextsWeakMap = new WeakMap<
  CreateModelDefinitionContext,
  Record<string, CreateModelDefinitionContext>
>();
function requireSubDefineModelContext(
  context: CreateModelDefinitionContext,
  path: string
) {
  let subContexts = subDefineModelContextsWeakMap.get(context);
  if (!subContexts) {
    subContexts = {};
    subDefineModelContextsWeakMap.set(context, subContexts);
  }

  let subContext = subContexts[path];
  if (!subContext) {
    subContext = Object.create(context, {
      state: {
        get() {
          return (context.state as Record<string, unknown> | undefined)?.[path];
        },
        enumerable: false,
        configurable: true,
      },
      getters: {
        get() {
          return (context.getters as Record<string, unknown> | undefined)?.[
            path
          ];
        },
        enumerable: false,
        configurable: true,
      },
      actions: {
        get() {
          return (context.actions as Record<string, unknown> | undefined)?.[
            path
          ];
        },
        enumerable: false,
        configurable: true,
      },
    }) as CreateModelDefinitionContext;
    subContexts[path] = subContext;
  }

  return subContext;
}

function convertSubModelDefinitionProperty(
  property: Record<string, unknown>,
  path: string
) {
  return mergeObjects({}, property, (item, k, target) => {
    target[k] = function (
      this: CreateModelDefinitionContext,
      ...args: unknown[]
    ) {
      return (item as Function).apply(
        requireSubDefineModelContext(this, path),
        args
      );
    };
  });
}

export function mergeModelDefinitions<
  TModelDefinitions extends
    | ModelDefinitionBase<Record<string, unknown>>[]
    | [ModelDefinitionBase<Record<string, unknown>>]
>(
  modelDefinitions: TModelDefinitions
): ModelDefinitionBase<
  {
    [K in keyof TModelDefinitions & number]: ExtractModelDefinitionState<
      TModelDefinitions[K]
    >;
  }[number],
  {
    [K in keyof TModelDefinitions & number]: ExtractModelDefinitionSelectors<
      TModelDefinitions[K]
    >;
  }[number],
  {
    [K in keyof TModelDefinitions & number]: ExtractModelDefinitionReducers<
      TModelDefinitions[K]
    >;
  }[number],
  {
    [K in keyof TModelDefinitions & number]: ExtractModelDefinitionEffects<
      TModelDefinitions[K]
    >;
  }[number],
  {
    [K in keyof TModelDefinitions &
      number]: ExtractModelDefinitionSubscriptions<TModelDefinitions[K]>;
  }[number]
>;
export function mergeModelDefinitions<
  TModelDefinitions extends Record<string, ModelDefinitionBase>
>(
  modelDefinitions: TModelDefinitions
): ModelDefinitionBase<
  {
    [K in keyof TModelDefinitions]: ExtractModelDefinitionState<
      TModelDefinitions[K]
    >;
  },
  {
    [K in keyof TModelDefinitions]: ExtractModelDefinitionSelectors<
      TModelDefinitions[K]
    >;
  },
  {
    [K in keyof TModelDefinitions]: ExtractModelDefinitionReducers<
      TModelDefinitions[K]
    >;
  },
  {
    [K in keyof TModelDefinitions]: ExtractModelDefinitionEffects<
      TModelDefinitions[K]
    >;
  },
  {
    [K in keyof TModelDefinitions]: ExtractModelDefinitionSubscriptions<
      TModelDefinitions[K]
    >;
  }
>;
export function mergeModelDefinitions(
  modelDefinitions:
    | ModelDefinitionBase<Record<string, unknown>>[]
    | Record<string, ModelDefinitionBase>
): ModelDefinitionBase {
  if (Array.isArray(modelDefinitions)) {
    return {
      state() {
        return modelDefinitions.reduce(
          (prev, curr) => mergeObjects(prev, curr.state.call(this)),
          {}
        );
      },
      selectors: modelDefinitions.reduce(
        (prev, curr) => mergeObjects(prev, curr.selectors),
        {}
      ),
      reducers: modelDefinitions.reduce(
        (prev, curr) => mergeObjects(prev, curr.reducers),
        {}
      ),
      effects: modelDefinitions.reduce(
        (prev, curr) => mergeObjects(prev, curr.effects),
        {}
      ),
      subscriptions: modelDefinitions.reduce(
        (prev, curr) => mergeObjects(prev, curr.subscriptions),
        {}
      ),
    };
  } else {
    return {
      state(this: CreateModelDefinitionContext) {
        return Object.entries(modelDefinitions).reduce<Record<string, unknown>>(
          (prev, [key, value]) => {
            prev[key] = value.state.call(
              requireSubDefineModelContext(this, key)
            );
            return prev;
          },
          {}
        );
      },
      selectors: Object.entries(modelDefinitions).reduce<
        Record<string, unknown>
      >((prev, [key, value]) => {
        prev[key] = convertSubModelDefinitionProperty(value.selectors, key);
        return prev;
      }, {}),
      reducers: Object.entries(modelDefinitions).reduce<
        Record<string, unknown>
      >((prev, [key, value]) => {
        prev[key] = convertSubModelDefinitionProperty(value.reducers, key);
        return prev;
      }, {}),
      effects: Object.entries(modelDefinitions).reduce<Record<string, unknown>>(
        (prev, [key, value]) => {
          prev[key] = convertSubModelDefinitionProperty(value.effects, key);
          return prev;
        },
        {}
      ),
      subscriptions: Object.entries(modelDefinitions).reduce<
        Record<string, unknown>
      >((prev, [key, value]) => {
        prev[key] = convertSubModelDefinitionProperty(value.subscriptions, key);
        return prev;
      }, {}),
    };
  }
}
