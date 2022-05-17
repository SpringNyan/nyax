export type Reducer<TPayload = unknown> = (payload: TPayload) => void;

export type ConvertReducersTypeParams<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends Reducer<infer TPayload>
    ? [{ payload: TPayload }]
    : ConvertReducersTypeParams<TReducers[K]>;
};
