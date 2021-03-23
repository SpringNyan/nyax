export interface ModelInitialState {
  [key: string]: unknown | ModelInitialState;
}

export type ConvertState<TInitialState> = TInitialState extends any
  ? TInitialState
  : never;

// ok
