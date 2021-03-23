export type ModelReducer<TPayload = unknown> = {
  bivarianceHack(payload: TPayload): void;
}["bivarianceHack"];

export interface ModelReducers {
  [key: string]: ModelReducer | ModelReducers;
}

export type ConvertActionHelperTypeParamTuplesFromModelReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends ModelReducer<infer TPayload>
    ? [TPayload, unknown]
    : ConvertActionHelperTypeParamTuplesFromModelReducers<TReducers[K]>;
};

// ok
