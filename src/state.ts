export interface InitialState {
  [key: string]: any;
}

export type ConvertState<
  TInitialState
> = TInitialState extends infer TInitialState ? TInitialState : never;
