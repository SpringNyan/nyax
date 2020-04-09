export interface Effects {
  [key: string]: ((payload: any) => Promise<any>) | Effects;
}

export type ConvertPayloadResultPairsFromEffects<TEffects> = {
  [K in keyof TEffects]: TEffects[K] extends (
    payload: infer TPayload
  ) => Promise<infer TResult>
    ? [TPayload, TResult]
    : ConvertPayloadResultPairsFromEffects<TEffects[K]>;
};
