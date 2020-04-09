export interface Selectors {
  [key: string]: (() => any) | Selectors;
}

export type ConvertGetters<TSelectors> = TSelectors extends infer TSelectors
  ? {
      [K in keyof TSelectors]: TSelectors[K] extends () => infer TResult
        ? TResult
        : ConvertGetters<TSelectors[K]>;
    }
  : never;
