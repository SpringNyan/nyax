import { ConvertActionHelpers } from "./action";
import { ConvertArgs, DefaultArgs } from "./arg";
import { Effects } from "./effect";
import { Epics } from "./epic";
import { Reducers } from "./reducer";
import { ConvertGetters, Selectors } from "./selector";
import { ConvertState, InitialState } from "./state";
import { TryReturnType } from "./util";

export interface ModelProps<
  TDefaultArgs extends DefaultArgs = any,
  TInitialState extends InitialState = any,
  TSelectors extends Selectors = any,
  TReducers extends Reducers = any,
  TEffects extends Effects = any,
  TEpics extends Epics = any
> {
  args: TDefaultArgs;
  state: TInitialState;
  selectors: TSelectors;
  reducers: TReducers;
  effects: TEffects;
  epics: TEpics;
}

export function createModelProps<TModelProps extends Partial<ModelProps>>(
  props: TModelProps
): ModelProps<{}, {}, {}, {}, {}, {}> & TModelProps {
  return {
    args: {},
    state: {},
    selectors: {},
    reducers: {},
    effects: {},
    epics: {},
    ...props,
  };
}

export class Model<
  TDependencies = any,
  TModelProps extends ModelProps = ModelProps
> {
  public setup(): TModelProps {
    return createModelProps({}) as TModelProps;
  }

  public dependencies!: TDependencies;
  public args!: ConvertArgs<TryReturnType<ReturnType<this["setup"]>["args"]>>;
  public state!: ConvertState<
    TryReturnType<ReturnType<this["setup"]>["state"]>
  >;
  public getters!: ConvertGetters<ReturnType<this["setup"]>["selectors"]>;
  public actions!: ConvertActionHelpers<
    ReturnType<this["setup"]>["reducers"],
    ReturnType<this["setup"]>["effects"]
  >;
}
