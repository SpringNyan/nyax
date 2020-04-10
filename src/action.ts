import { ConvertPayloadResultPairsFromEffects } from "./effect";
import { ConvertPayloadResultPairsFromReducers } from "./reducer";

export interface AnyAction {
  type: string;
  payload?: any;
}

export interface Action<TPayload> {
  type: string;
  payload: TPayload;
}

export interface ActionHelper<TPayload, TResult> {
  type: string;
  is(action: any): action is Action<TPayload>;
  create(payload: TPayload): Action<TPayload>;
  dispatch(payload: TPayload): Promise<TResult>;
}

export interface ActionHelpers {
  [key: string]: ActionHelper<any, any> | ActionHelpers;
}

export type ConvertActionHelpersFromPayloadResultPairs<T> = {
  [K in keyof T]: T[K] extends [any, any]
    ? ActionHelper<T[K][0], T[K][1]>
    : ConvertActionHelpersFromPayloadResultPairs<T[K]>;
};

export type ConvertActionHelpers<
  TReducers,
  TEffects
> = TReducers extends infer TReducers
  ? TEffects extends infer TEffects
    ? ConvertActionHelpersFromPayloadResultPairs<
        ConvertPayloadResultPairsFromReducers<TReducers> &
          ConvertPayloadResultPairsFromEffects<TEffects>
      >
    : never
  : never;
