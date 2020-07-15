export type ModelEffect<TPayload = any, TResult = unknown> = (
  payload: TPayload
) => Promise<TResult>;

export interface ModelEffects {
  [key: string]: ModelEffect | ModelEffects;
}

export type ConvertPayloadResultPairsFromModelEffects<TEffects> = {
  [K in keyof TEffects]: TEffects[K] extends ModelEffect<
    infer TPayload,
    infer TResult
  >
    ? [TPayload, TResult]
    : ConvertPayloadResultPairsFromModelEffects<TEffects[K]>;
};
