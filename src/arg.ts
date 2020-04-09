export const NYAX_REQUIRED_ARG: unique symbol = "__nyax_required_arg__" as any;
export const NYAX_ARGS: unique symbol = "__nyax_args__" as any;

export interface RequiredArg<T> {
  [NYAX_REQUIRED_ARG]: true;
  defaultValue?: T;
}

export interface DefaultArgs {
  [key: string]: any;
}

export type ConvertArgs<TDefaultArgs> = TDefaultArgs extends infer TDefaultArgs
  ? {
      [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg<infer T>
        ? T
        : TDefaultArgs[K] extends { [NYAX_ARGS]: true }
        ? Omit<TDefaultArgs[K], typeof NYAX_ARGS>
        : TDefaultArgs[K];
    }
  : never;

export function createRequiredArg<T>(defaultValue?: T): RequiredArg<T> {
  return {
    [NYAX_REQUIRED_ARG]: true,
    defaultValue,
  };
}
