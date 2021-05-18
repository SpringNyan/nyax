export type Effect<TPayload = unknown, TResult = unknown> = {
  bivarianceHack(payload: TPayload): Promise<TResult>;
}["bivarianceHack"];

export interface Effects {
  [key: string]: Effect | Effects;
}

export type ConvertActionHelperTypeParamsObjectFromEffects<TEffects> = {
  [K in keyof TEffects]: TEffects[K] extends Effect<
    infer TPayload,
    infer TResult
  >
    ? [TPayload, TResult]
    : ConvertActionHelperTypeParamsObjectFromEffects<TEffects[K]>;
};
