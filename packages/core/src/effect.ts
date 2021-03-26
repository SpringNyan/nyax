export type ModelEffect<TPayload = unknown, TResult = unknown> = {
  bivarianceHack(payload: TPayload): Promise<TResult>;
}["bivarianceHack"];

export interface ModelEffects {
  [key: string]: ModelEffect | ModelEffects;
}

export type ConvertActionHelperTypeParamsTuplesFromModelEffects<TEffects> = {
  [K in keyof TEffects]: TEffects[K] extends ModelEffect<
    infer TPayload,
    infer TResult
  >
    ? [TPayload, TResult]
    : ConvertActionHelperTypeParamsTuplesFromModelEffects<TEffects[K]>;
};

// ok
