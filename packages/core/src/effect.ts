export type Effect<TPayload = unknown, TResult = unknown> = (
  payload: TPayload
) => TResult;

export type ConvertEffectsTypeParams<TEffects> = {
  [K in keyof TEffects]: TEffects[K] extends Effect<
    infer TPayload,
    infer TResult
  >
    ? [{ payload: TPayload; result: TResult }]
    : ConvertEffectsTypeParams<TEffects[K]>;
};

// ok
