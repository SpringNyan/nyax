export type ModelEffect<TPayload, TResult> = (
  payload: TPayload
) => Promise<TResult>;

export interface ModelEffects {
  [key: string]: ModelEffect<unknown, unknown> | ModelEffects;
}

export type ConvertPayloadResultPairsFromModelEffects<TEffects> = {
  [K in keyof TEffects]: TEffects[K] extends ModelEffect<
    infer TPayload,
    infer TResult
  >
    ? [TPayload, TResult]
    : ConvertPayloadResultPairsFromModelEffects<TEffects[K]>;
};
