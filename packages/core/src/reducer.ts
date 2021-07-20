export type Reducer<TPayload = unknown> = {
  bivarianceHack(payload: TPayload): void;
}["bivarianceHack"];

export interface Reducers {
  [key: string]: Reducer | Reducers;
}

export type ConvertActionHelperTypeParamsObjectFromReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends Reducer<infer TPayload>
    ? [TPayload, unknown]
    : ConvertActionHelperTypeParamsObjectFromReducers<TReducers[K]>;
};
