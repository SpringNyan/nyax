export interface Reducers {
  [key: string]: ((payload: any) => void) | Reducers;
}

export type ConvertPayloadResultPairsFromReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends (payload: infer TPayload) => void
    ? [TPayload, unknown]
    : ConvertPayloadResultPairsFromReducers<TReducers[K]>;
};
