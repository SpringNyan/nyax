export type Effect<TPayload = unknown, TResult = unknown> = (
  payload: TPayload
) => Promise<TResult>;

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

// ok3
