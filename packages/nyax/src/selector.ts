import { NyaxContext } from "./context";
import { Model } from "./model";
import {
  ConvertModelDefinitionGetters,
  ModelDefinitionBase,
} from "./modelDefinition";
import { defineGetter, mergeObjects } from "./util";

export type Selector<TResult = unknown> = () =>
  | TResult
  | OutputSelector<TResult>;

export type ConvertGetters<TSelectors> = {
  [K in keyof TSelectors]: TSelectors[K] extends Selector<infer TResult>
    ? TResult
    : ConvertGetters<TSelectors[K]>;
};

export function createGetters<TModelDefinition extends ModelDefinitionBase>(
  _nyaxContext: NyaxContext,
  model: Model
): ConvertModelDefinitionGetters<TModelDefinition> {
  const getters = {} as ConvertModelDefinitionGetters<TModelDefinition>;

  mergeObjects(getters, model.modelDefinition.selectors, (item, k, target) => {
    const selector = (item as Selector).bind(model);
    defineGetter(target, k, () => {
      const result = selector();
      delete target[k];
      if (typeof result === "function" && OutputSelectorBrand in result) {
        defineGetter(target, k, result as OutputSelector);
        return target[k];
      } else {
        defineGetter(target, k, selector);
        return result;
      }
    });
  });

  return getters;
}

const OutputSelectorBrand = "__NYAX_SELECTOR__";

export type InputSelector<TResult = unknown> = (
  lastResult?: TResult
) => TResult;
export type OutputSelector<TResult = unknown> = (() => TResult) & {
  [OutputSelectorBrand]: true;
};
export interface CreateSelector {
  <TDeps extends any[] | [any], TResult>(
    selectors: { [K in keyof TDeps]: InputSelector<TDeps[K]> },
    combiner: (deps: TDeps, lastResult?: TResult) => TResult
  ): OutputSelector<TResult>;
  <TDeps extends any[], TResult>(
    ...args: [
      ...selectors: { [K in keyof TDeps]: InputSelector<TDeps[K]> },
      combiner: (...deps: TDeps) => TResult
    ]
  ): OutputSelector<TResult>;
  <TDeps extends any[], TResult>(
    ...args: [
      ...selectors: { [K in keyof TDeps]: InputSelector<TDeps[K]> },
      combiner: (...args: [...deps: TDeps, lastResult?: TResult]) => TResult
    ]
  ): OutputSelector<TResult>;
}

export const createSelector: CreateSelector = function createSelector(
  ...args: unknown[]
): OutputSelector<unknown> {
  const arrayMode = Array.isArray(args[0]);
  const selectors = (
    arrayMode ? args[0] : args.slice(0, args.length - 1)
  ) as InputSelector<unknown>[];
  const combiner = args[args.length - 1] as (...args: unknown[]) => unknown;

  let lastDeps: unknown[] | undefined;
  let lastResult: unknown | undefined;

  const outputSelector = function () {
    let needUpdate = !lastDeps;
    if (lastDeps === undefined) {
      lastDeps = [];
    }

    const currDeps: unknown[] = [];
    for (let i = 0; i < selectors.length; i += 1) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      currDeps.push(selectors[i]!(lastDeps[i]));
      if (!needUpdate && currDeps[i] !== lastDeps[i]) {
        needUpdate = true;
      }
    }

    lastDeps = currDeps;
    if (needUpdate) {
      lastResult = arrayMode
        ? combiner(currDeps, lastResult)
        : combiner(...currDeps, lastResult);
    }

    return lastResult;
  };
  outputSelector.__NYAX_SELECTOR__ = true as const;

  return outputSelector;
};
