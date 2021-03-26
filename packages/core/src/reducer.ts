export type ModelReducer<TPayload = unknown> = {
  bivarianceHack(payload: TPayload): void;
}["bivarianceHack"];

export interface ModelReducers {
  [key: string]: ModelReducer | ModelReducers;
}

export type ConvertActionHelperTypeParamsTuplesFromModelReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends ModelReducer<infer TPayload>
    ? [TPayload, unknown]
    : ConvertActionHelperTypeParamsTuplesFromModelReducers<TReducers[K]>;
};

// ok
