export type Reducer<TPayload = unknown> = (payload: TPayload) => void;

export interface Reducers {
  [key: string]: Reducer | Reducers;
}

export type ConvertActionHelperTypeParamsObjectFromReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends Reducer<infer TPayload>
    ? [TPayload, unknown]
    : ConvertActionHelperTypeParamsObjectFromReducers<TReducers[K]>;
};

// ok2
