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
import { ConvertGetters } from "./selector";
import { Nyax } from "./store";
import { asType, mergeObjects } from "./util";

export interface ModelDefinition<
  TState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
> {
  state(): TState;
  selectors: TSelectors;
  reducers: TReducers;
  effects: TEffects;
  subscriptions: TSubscriptions;
}

export interface NamespacedModelDefinition<
  TState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {},
  TDynamic extends boolean = boolean
> extends ModelDefinition<
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
  TModelDefinition extends ModelDefinition
> = TModelDefinition extends ModelDefinition<infer T, any, any, any, any>
  ? T
  : never;
export type ExtractModelDefinitionSelectors<
  TModelDefinition extends ModelDefinition
> = TModelDefinition extends ModelDefinition<any, infer T, any, any, any>
  ? T
  : never;
export type ExtractModelDefinitionReducers<
  TModelDefinition extends ModelDefinition
> = TModelDefinition extends ModelDefinition<any, any, infer T, any, any>
  ? T
  : never;
export type ExtractModelDefinitionEffects<
  TModelDefinition extends ModelDefinition
> = TModelDefinition extends ModelDefinition<any, any, any, infer T, any>
  ? T
  : never;
export type ExtractModelDefinitionSubscriptions<
  TModelDefinition extends ModelDefinition
> = TModelDefinition extends ModelDefinition<any, any, any, any, infer T>
  ? T
  : never;

export type ConvertModelDefinitionState<
  TModelDefinition extends ModelDefinition
> = ExtractModelDefinitionState<TModelDefinition>;
export type ConvertModelDefinitionGetters<
  TModelDefinition extends ModelDefinition
> = ConvertGetters<ExtractModelDefinitionSelectors<TModelDefinition>>;
export type ConvertModelDefinitionActionHelpers<
  TModelDefinition extends ModelDefinition
> = ConvertActionHelpers<
  ExtractModelDefinitionReducers<TModelDefinition>,
  ExtractModelDefinitionEffects<TModelDefinition>
> & {
  [ModelMountActionType]: ActionHelper<
    ModelMountActionPayload<ConvertModelDefinitionState<TModelDefinition>>
  >;
  [ModelUnmountActionType]: ActionHelper<ModelUnmountActionPayload>;
  [ModelSetActionType]: ActionHelper<
    ModelSetActionPayload<ConvertModelDefinitionState<TModelDefinition>>
  >;
  [ModelPatchActionType]: ActionHelper<
    ModelPatchActionPayload<ConvertModelDefinitionState<TModelDefinition>>
  >;
};

export interface DefineModelContext<
  TState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {}
> {
  state: TState;
  getters: ConvertGetters<TSelectors>;
  actions: ConvertActionHelpers<TReducers, TEffects>;

  namespace: string;
  key: string | undefined;
  fullNamespace: string;

  isMounted: boolean;

  getModel: GetModel;
  nyax: Nyax;
}

type CreateModelDefinitionOptions<
  TState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
> = {
  state(): TState;
  selectors?: TSelectors;
  reducers?: TReducers;
  effects?: TEffects;
  subscriptions?: TSubscriptions;
} & ThisType<DefineModelContext<TState, TSelectors, TReducers, TEffects>>;

type ExtendModelDefinitionOptions<
  TBaseModelDefinition extends ModelDefinition = ModelDefinition,
  TState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
> = {
  state?(): TState;
  selectors?: TSelectors;
  reducers?: TReducers;
  effects?: TEffects;
  subscriptions?: TSubscriptions;
} & ThisType<
  DefineModelContext<
    ExtractModelDefinitionState<TBaseModelDefinition> & TState,
    ExtractModelDefinitionSelectors<TBaseModelDefinition> & TSelectors,
    ExtractModelDefinitionReducers<TBaseModelDefinition> & TReducers,
    ExtractModelDefinitionEffects<TBaseModelDefinition> & TEffects
  >
>;

export function createModelDefinition<
  TState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
>(
  options: CreateModelDefinitionOptions<
    TState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  >
): ModelDefinition<TState, TSelectors, TReducers, TEffects, TSubscriptions>;
export function createModelDefinition<
  TState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {},
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
): ModelDefinition<TState, TSelectors, TReducers, TEffects, TSubscriptions>;
export function createModelDefinition(...args: unknown[]): ModelDefinition {
  const hasNamespace = typeof args[0] === "string";

  const options = (
    hasNamespace ? args[1] : args[0]
  ) as CreateModelDefinitionOptions;
  const modelDefinition: ModelDefinition = {
    state: options.state,
    selectors: options.selectors ?? {},
    reducers: options.reducers ?? {},
    effects: options.effects ?? {},
    subscriptions: options.subscriptions ?? {},
  };

  if (hasNamespace) {
    asType<NamespacedModelDefinition>(modelDefinition);
    modelDefinition.namespace = args[0] as string;
    modelDefinition.isDynamic = (args[2] ?? false) as boolean;
  }

  return modelDefinition;
}

export function extendModelDefinition<
  TBaseModelDefinition extends ModelDefinition<
    Record<string, unknown>
  > = ModelDefinition,
  TState extends Record<string, unknown> = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
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
): ModelDefinition<
  ExtractModelDefinitionState<TBaseModelDefinition> & TState,
  ExtractModelDefinitionSelectors<TBaseModelDefinition> & TSelectors,
  ExtractModelDefinitionReducers<TBaseModelDefinition> & TReducers,
  ExtractModelDefinitionEffects<TBaseModelDefinition> & TEffects,
  ExtractModelDefinitionSubscriptions<TBaseModelDefinition> & TSubscriptions
> {
  const modelDefinition: ModelDefinition = {
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

function createSubDefineModelContext(
  context: DefineModelContext,
  path: string
) {
  return Object.create(context, {
    state: {
      get() {
        return (context.state as Record<string, unknown> | undefined)?.[path];
      },
      enumerable: false,
      configurable: true,
    },
    getters: {
      get() {
        return (context.getters as Record<string, unknown> | undefined)?.[path];
      },
      enumerable: false,
      configurable: true,
    },
    actions: {
      get() {
        return (context.actions as Record<string, unknown> | undefined)?.[path];
      },
      enumerable: false,
      configurable: true,
    },
  });
}

function convertSubModelDefinitionProperty(
  property: Record<string, unknown>,
  path: string
) {
  return mergeObjects({}, property, function (item, k, target) {
    target[k] = function (this: DefineModelContext, ...args: unknown[]) {
      return (item as Function).apply(
        createSubDefineModelContext(this, path),
        args
      );
    };
  });
}

export function mergeModelDefinitions<
  TModelDefinitions extends
    | ModelDefinition<Record<string, unknown>>[]
    | [ModelDefinition<Record<string, unknown>>]
>(
  modelDefinitions: TModelDefinitions
): ModelDefinition<
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
  TModelDefinitions extends Record<string, ModelDefinition>
>(
  modelDefinitions: TModelDefinitions
): ModelDefinition<
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
    | ModelDefinition<Record<string, unknown>>[]
    | Record<string, ModelDefinition>
): ModelDefinition {
  if (Array.isArray(modelDefinitions)) {
    return {
      state() {
        return modelDefinitions.reduce((prev, curr) => {
          return Object.assign(prev, curr.state.call(this));
        }, {});
      },
      selectors: modelDefinitions.reduce(function (prev, curr) {
        return Object.assign(prev, curr.selectors);
      }, {}),
      reducers: modelDefinitions.reduce(function (prev, curr) {
        return Object.assign(prev, curr.reducers);
      }, {}),
      effects: modelDefinitions.reduce(function (prev, curr) {
        return Object.assign(prev, curr.effects);
      }, {}),
      subscriptions: modelDefinitions.reduce(function (prev, curr) {
        return Object.assign(prev, curr.subscriptions);
      }, {}),
    };
  } else {
    return {
      state(this: DefineModelContext) {
        return Object.entries(modelDefinitions).reduce<Record<string, unknown>>(
          (prev, [key, value]) => {
            prev[key] = value.state.call(
              createSubDefineModelContext(this, key)
            );
            return prev;
          },
          {}
        );
      },
      selectors: Object.entries(modelDefinitions).reduce<
        Record<string, unknown>
      >(function (prev, [key, value]) {
        prev[key] = convertSubModelDefinitionProperty(value.selectors, key);
        return prev;
      }, {}),
      reducers: Object.entries(modelDefinitions).reduce<
        Record<string, unknown>
      >(function (prev, [key, value]) {
        prev[key] = convertSubModelDefinitionProperty(value.reducers, key);
        return prev;
      }, {}),
      effects: Object.entries(modelDefinitions).reduce<Record<string, unknown>>(
        function (prev, [key, value]) {
          prev[key] = convertSubModelDefinitionProperty(value.effects, key);
          return prev;
        },
        {}
      ),
      subscriptions: Object.entries(modelDefinitions).reduce<
        Record<string, unknown>
      >(function (prev, [key, value]) {
        prev[key] = convertSubModelDefinitionProperty(value.subscriptions, key);
        return prev;
      }, {}),
    };
  }
}
