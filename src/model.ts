import { ConvertActionHelpers } from "./action";
import { ConvertArgs, DefaultArgs } from "./arg";
import { Effects } from "./effect";
import { Epics } from "./epic";
import { Reducers } from "./reducer";
import { ConvertGetters, Selectors } from "./selector";
import { ConvertState, InitialState } from "./state";

export interface Model<
  TDependencies,
  TDefaultArgs extends DefaultArgs,
  TInitialState extends InitialState,
  TSelectors extends Selectors,
  TReducers extends Reducers,
  TEffects extends Effects,
  TEpics extends Epics
> {
  defaultArgs(): TDefaultArgs;
  initialState(): TInitialState;
  selectors(): TSelectors;
  reducers(): TReducers;
  effects(): TEffects;
  epics(): TEpics;

  dependencies: TDependencies;
  args: ConvertArgs<ReturnType<this["defaultArgs"]>>;
  state: ConvertState<ReturnType<this["initialState"]>>;
  getters: ConvertGetters<ReturnType<this["selectors"]>>;
  actions: ConvertActionHelpers<
    ReturnType<this["reducers"]>,
    ReturnType<this["effects"]>
  >;
}

export type ModelConstructor<
  TDependencies,
  TDefaultArgs extends DefaultArgs,
  TInitialState extends InitialState,
  TSelectors extends Selectors,
  TReducers extends Reducers,
  TEffects extends Effects,
  TEpics extends Epics
> = new () => Model<
  TDependencies,
  TDefaultArgs,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TEpics
>;

export class ModelBase<TDependencies>
  implements
    Model<
      TDependencies,
      DefaultArgs,
      InitialState,
      Selectors,
      Reducers,
      Effects,
      Epics
    > {
  public defaultArgs(): DefaultArgs {
    return {};
  }
  public initialState(): InitialState {
    return {};
  }
  public selectors(): Selectors {
    return {};
  }
  public reducers(): Reducers {
    return {};
  }
  public effects(): Effects {
    return {};
  }
  public epics(): Epics {
    return {};
  }

  public dependencies!: TDependencies;
  public args!: ConvertArgs<ReturnType<this["defaultArgs"]>>;
  public state!: ConvertState<ReturnType<this["initialState"]>>;
  public getters!: ConvertGetters<ReturnType<this["selectors"]>>;
  public actions!: ConvertActionHelpers<
    ReturnType<this["reducers"]>,
    ReturnType<this["effects"]>
  >;
}
