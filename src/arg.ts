import { NYAX_NOTHING } from "./common";
import { isObject } from "./util";

export const NYAX_REQUIRED_ARG_KEY: unique symbol = "__nyax_required_arg__" as any;
export const NYAX_DEFAULT_ARGS_KEY: unique symbol = "__nyax_default_args__" as any;

export interface RequiredArg<T = any> {
  [NYAX_REQUIRED_ARG_KEY]: true;
  defaultValue: T | typeof NYAX_NOTHING;
}

export interface DefaultArgs {
  [key: string]: any;
}

export interface MarkedDefaultArgs extends DefaultArgs {
  [NYAX_DEFAULT_ARGS_KEY]: true;
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
        [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg
          ? K
          : never;
      }[keyof TDefaultArgs]
    > &
      Partial<
        Pick<
          {
            [K in keyof TDefaultArgs]: TDefaultArgs[K] extends MarkedDefaultArgs
              ? ConvertArgsParam<
                  Omit<TDefaultArgs[K], typeof NYAX_DEFAULT_ARGS_KEY>
                >
              : TDefaultArgs[K];
          },
          {
            [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg
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
        : TDefaultArgs[K] extends MarkedDefaultArgs
        ? ConvertArgs<Omit<TDefaultArgs[K], typeof NYAX_DEFAULT_ARGS_KEY>>
        : TDefaultArgs[K];
    }
  : never;

export function createRequiredArg<T>(defaultValue?: T): RequiredArg<T> {
  return {
    [NYAX_REQUIRED_ARG_KEY]: true,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    defaultValue: arguments.length > 0 ? defaultValue! : NYAX_NOTHING,
  };
}

export function isRequiredArg(obj: any): obj is RequiredArg {
  return obj?.[NYAX_REQUIRED_ARG_KEY] === true;
}

export function isMarkedDefaultArgs(obj: any): obj is MarkedDefaultArgs {
  return obj?.[NYAX_DEFAULT_ARGS_KEY] === true;
}

export function createArgs<TDefaultArgs extends DefaultArgs>(
  defaultArgs: TDefaultArgs,
  argsParam: ConvertArgsParam<TDefaultArgs> | undefined,
  optional: boolean
): ConvertArgs<TDefaultArgs> {
  if (!isObject(defaultArgs)) {
    throw new Error("Default args is not an object");
  }

  const args: Record<string, any> = {};

  if (argsParam) {
    Object.keys(argsParam).forEach((key) => {
      if (!isMarkedDefaultArgs(defaultArgs[key])) {
        args[key] = argsParam[key];
      }
    });
  }

  Object.keys(defaultArgs).forEach((key) => {
    if (((key as unknown) as symbol) === NYAX_DEFAULT_ARGS_KEY || key in args) {
      return;
    }
    const defaultArg = defaultArgs[key];

    if (isMarkedDefaultArgs(defaultArg)) {
      args[key] = createArgs(defaultArg, argsParam?.[key], optional);
    } else if (isRequiredArg(defaultArg)) {
      if (optional && defaultArg.defaultValue !== NYAX_NOTHING) {
        args[key] = defaultArg.defaultValue;
      } else {
        throw new Error("Required arg is missing");
      }
    } else {
      args[key] = defaultArg;
    }
  });

  return args as ConvertArgs<TDefaultArgs>;
}
