export type CreateSelector = <TDeps extends any[], TResult>(
  ...args: [
    ...selectors: { [K in keyof TDeps]: () => TDeps[K] },
    combiner: (...args: [...deps: TDeps]) => TResult
  ]
) => () => TResult;

export const defaultCreateSelector: CreateSelector = (...args) => {
  const deps = args.slice(0, args.length - 1) as (() => any)[];
  const fn = args[args.length - 1] as (...args: any[]) => any;
  return () => fn(...deps.map((dep) => dep()));
};

export const testDependencies: {
  createSelector: CreateSelector;
} = {
  createSelector: defaultCreateSelector,
};

export interface Dependencies {
  packageName: string;
}
