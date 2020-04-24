import {
  batchRegisterActionHelper,
  batchUnregisterActionHelper,
  createActionHelpers,
} from "./action";
import { ConvertArgsParam, createArgs } from "./arg";
import { NYAX_NOTHING } from "./common";
import { ModelContext, NyaxContext } from "./context";
import { ModelEffect } from "./effect";
import {
  ExtractActionHelpersFromModel,
  ExtractArgsFromModel,
  ExtractDefaultArgsFromModel,
  ExtractEffectsFromModel,
  ExtractEpicsFromModel,
  ExtractGettersFromModel,
  ExtractReducersFromModel,
  ExtractSelectorsFromModel,
  ExtractStateFromModel,
  Model,
  ModelBase,
} from "./model";
import { ModelReducer } from "./reducer";
import { createGetters } from "./selector";
import { createState, getSubState } from "./state";
import { flattenObject, joinLastString } from "./util";

export interface ContainerBase<
  TState = any,
  TGetters = any,
  TActionHelpers = any
> {
  state: TState;
  getters: TGetters;
  actions: TActionHelpers;
}

export interface Container<TModel extends Model = Model>
  extends ContainerBase<
    ExtractStateFromModel<TModel>,
    ExtractGettersFromModel<TModel>,
    ExtractActionHelpersFromModel<TModel>
  > {
  modelNamespace: string;
  containerKey: string | undefined;

  isRegistered: boolean;
  canRegister: boolean;

  register(args?: ConvertArgsParam<ExtractDefaultArgsFromModel<TModel>>): void;
  unregister(): void;
}

export class ContainerImpl<TModel extends Model = Model>
  implements Container<TModel> {
  public readonly modelContext: ModelContext;

  public readonly modelNamespace: string;
  public readonly namespace: string;

  public readonly modelInstance: InstanceType<TModel>;

  public readonly selectors: ExtractSelectorsFromModel<TModel>;
  public readonly reducers: ExtractReducersFromModel<TModel>;
  public readonly effects: ExtractEffectsFromModel<TModel>;
  public readonly epics: ExtractEpicsFromModel<TModel>;

  public readonly reducerByPath: Record<string, ModelReducer>;
  public readonly effectByPath: Record<string, ModelEffect>;

  public modelArgs:
    | ExtractArgsFromModel<TModel>
    | typeof NYAX_NOTHING = NYAX_NOTHING;
  public modelState:
    | ExtractStateFromModel<TModel>
    | typeof NYAX_NOTHING = NYAX_NOTHING;

  private _initialStateCache: any;

  private _lastRootState: any;
  private _lastState: any;

  private _gettersCache: any;

  private _actionsCache: any;

  constructor(
    private readonly _nyaxContext: NyaxContext,
    public readonly model: TModel,
    public readonly containerKey: string | undefined
  ) {
    const modelContext = this._nyaxContext.modelContextByModel.get(this.model);
    if (!modelContext) {
      throw new Error("Model is not registered");
    }

    this.modelContext = modelContext;

    this.modelNamespace = this.modelContext.modelNamespace;
    this.namespace = joinLastString(this.modelNamespace, this.containerKey);

    this.modelInstance = this._createModelInstance();

    this.selectors = this.modelInstance.selectors();
    this.reducers = this.modelInstance.reducers();
    this.effects = this.modelInstance.effects();
    this.epics = this.modelInstance.epics();
    this.reducerByPath = flattenObject(this.reducers);
    this.effectByPath = flattenObject(this.effects);
  }

  public get state(): ExtractStateFromModel<TModel> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.state;
    }

    if (this.isRegistered) {
      const rootState = this._nyaxContext.getRootState();
      if (this._lastRootState === rootState) {
        return this._lastState;
      }

      const state = getSubState(
        rootState,
        this.modelContext.modelPath,
        this.containerKey
      );

      this._lastRootState = rootState;
      this._lastState = state;

      return state;
    }

    if (this.canRegister) {
      if (this._initialStateCache === undefined) {
        this._initialStateCache = createState(
          this,
          createArgs(this, undefined, true)
        );
      }
      return this._initialStateCache;
    }

    throw new Error("Namespace is already bound by other container");
  }

  public get getters(): ExtractGettersFromModel<TModel> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.getters;
    }

    if (this.isRegistered || this.canRegister) {
      if (this._gettersCache === undefined) {
        this._gettersCache = createGetters(this);
      }

      return this._gettersCache;
    }

    throw new Error("Namespace is already bound by other container");
  }

  public get actions(): ExtractActionHelpersFromModel<TModel> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.actions;
    }

    if (this.isRegistered || this.canRegister) {
      if (this._actionsCache === undefined) {
        this._actionsCache = createActionHelpers(this._nyaxContext, this);
      }

      return this._actionsCache;
    }

    throw new Error("Namespace is already bound by other container");
  }

  public get isRegistered(): boolean {
    const container = this._nyaxContext.containerByNamespace.get(
      this.namespace
    );
    return container?.model === this.model;
  }

  public get canRegister(): boolean {
    return !this._nyaxContext.containerByNamespace.has(this.namespace);
  }

  public register(
    args?: ConvertArgsParam<ExtractDefaultArgsFromModel<TModel>>
  ): void {
    if (!this.canRegister) {
      throw new Error("Namespace is already bound");
    }

    this._nyaxContext.store.dispatch(
      batchRegisterActionHelper.create([
        {
          modelNamespace: this.modelNamespace,
          containerKey: this.containerKey,
          args,
        },
      ])
    );
  }

  public unregister(): void {
    if (this.isRegistered) {
      this._nyaxContext.store.dispatch(
        batchUnregisterActionHelper.create([
          {
            modelNamespace: this.modelNamespace,
            containerKey: this.containerKey,
          },
        ])
      );
    }

    this.modelContext.containerByContainerKey.delete(this.containerKey);
  }

  private get _currentContainer(): this {
    return this._nyaxContext.getContainer(
      this.model,
      this.containerKey
    ) as this;
  }

  private _createModelInstance(): InstanceType<TModel> {
    const modelInstance = new this.model() as ModelBase;
    modelInstance._nyaxContext = this._nyaxContext;
    modelInstance._container = this;
    return modelInstance as InstanceType<TModel>;
  }
}

export interface GetContainer {
  <TModel extends Model>(
    modelOrModelNamespace: TModel | string
  ): TModel["isDynamic"] extends true ? never : Container<TModel>;
  <TModel extends Model>(
    modelOrModelNamespace: TModel | string,
    containerKey: string
  ): TModel["isDynamic"] extends true ? Container<TModel> : never;
}

export interface GetContainerInternal {
  <TModel extends Model>(
    modelOrModelNamespace: TModel | string,
    containerKey?: string
  ): ContainerImpl<TModel>;
}

export function createGetContainer(
  nyaxContext: NyaxContext
): GetContainerInternal {
  return <TModel extends Model>(
    modelOrModelNamespace: TModel | string,
    containerKey?: string
  ): ContainerImpl<TModel> => {
    let model: TModel;
    if (typeof modelOrModelNamespace === "string") {
      model = nyaxContext.modelByModelNamespace.get(
        modelOrModelNamespace
      ) as TModel;
      if (!model) {
        throw new Error("Model namespace is not bound");
      }
    } else {
      model = modelOrModelNamespace;
    }

    const modelContext = nyaxContext.modelContextByModel.get(model);
    if (!modelContext) {
      throw new Error("Model is not registered");
    }

    if (containerKey === undefined && model.isDynamic) {
      throw new Error("Container key is required for dynamic model");
    }

    if (containerKey !== undefined && !model.isDynamic) {
      throw new Error("Container key is not available for static model");
    }

    let container = modelContext.containerByContainerKey.get(
      containerKey
    ) as ContainerImpl<TModel>;
    if (!container) {
      container = new ContainerImpl(nyaxContext, model, containerKey);
      modelContext.containerByContainerKey.set(containerKey, container);
    }

    return container;
  };
}

export function createSubContainer<
  TContainer extends ContainerBase,
  TSubKey extends string
>(
  container: TContainer,
  subKey: TSubKey
): ContainerBase<
  TContainer["state"][TSubKey],
  TContainer["getters"][TSubKey],
  TContainer["actions"][TSubKey]
> {
  return {
    get state(): TContainer["state"][TSubKey] {
      return container.state[subKey];
    },
    get getters(): TContainer["getters"][TSubKey] {
      return container.getters[subKey];
    },
    get actions(): TContainer["actions"][TSubKey] {
      return container.actions[subKey];
    },
  };
}
