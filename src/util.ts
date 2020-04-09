export type TryReturnType<T> = T extends (...args: any[]) => infer TResult
  ? TResult
  : T;
