export interface InitialState {
  [key: string]: unknown | InitialState;
}

export type ConvertState<TInitialState> = TInitialState extends any
  ? TInitialState
  : never;

// ok2
