export const NYAX_REQUIRED_ARG: unique symbol = "__nyax_required_arg__" as any;
export const NYAX_ARGS: unique symbol = "__nyax_args__" as any;

export interface RequiredArg<T> {
  [NYAX_REQUIRED_ARG]: true;
  defaultValue?: T;
}

export interface DefaultArgs {
  [key: string]: any;
}

export type ConvertArgsParam<
  TDefaultArgs
> = TDefaultArgs extends infer TDefaultArgs
  ? Pick<
      {
        [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg<infer T>
          ? T
          : never;
      },
      {
        [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg<any>
          ? K
          : never;
      }[keyof TDefaultArgs]
    > &
      Partial<
        Pick<
          {
            [K in keyof TDefaultArgs]: TDefaultArgs[K] extends {
              [NYAX_ARGS]: true;
            }
              ? ConvertArgsParam<Omit<TDefaultArgs[K], typeof NYAX_ARGS>>
              : TDefaultArgs[K];
          },
          {
            [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg<any>
              ? never
              : K;
          }[keyof TDefaultArgs]
        >
      >
  : never;

export type ConvertArgs<TDefaultArgs> = TDefaultArgs extends infer TDefaultArgs
  ? {
      [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg<infer T>
        ? T
        : TDefaultArgs[K] extends { [NYAX_ARGS]: true }
        ? ConvertArgs<Omit<TDefaultArgs[K], typeof NYAX_ARGS>>
        : TDefaultArgs[K];
    }
  : never;

export function createRequiredArg<T>(defaultValue?: T): RequiredArg<T> {
  return {
    [NYAX_REQUIRED_ARG]: true,
    defaultValue,
  };
}
