import { NYAX_NOTHING } from "./common";
import { ContainerImpl } from "./container";
import {
  ExtractArgsFromModelConstructor,
  ExtractDefaultArgsFromModelConstructor,
  ModelConstructor,
} from "./model";
import { isObject } from "./util";

export const NYAX_REQUIRED_ARG_KEY: unique symbol = "__nyax_required_arg__" as any;
export const NYAX_DEFAULT_ARGS_KEY: unique symbol = "__nyax_default_args__" as any;

export interface RequiredArg<T = any> {
  [NYAX_REQUIRED_ARG_KEY]: true;
  defaultValue: T | typeof NYAX_NOTHING;
}

export interface ModelDefaultArgs {
  [key: string]: any;
}

export interface MarkedModelDefaultArgs extends ModelDefaultArgs {
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
            [K in keyof TDefaultArgs]: TDefaultArgs[K] extends MarkedModelDefaultArgs
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
        : TDefaultArgs[K] extends MarkedModelDefaultArgs
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

export function isMarkedDefaultArgs(obj: any): obj is MarkedModelDefaultArgs {
  return obj?.[NYAX_DEFAULT_ARGS_KEY] === true;
}

export function buildArgs<TDefaultArgs extends ModelDefaultArgs>(
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
    if (((key as any) as symbol) === NYAX_DEFAULT_ARGS_KEY || key in args) {
      return;
    }
    const defaultArg = defaultArgs[key];

    if (isMarkedDefaultArgs(defaultArg)) {
      args[key] = buildArgs(defaultArg, argsParam?.[key], optional);
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

export function createArgs<TModelConstructor extends ModelConstructor>(
  container: ContainerImpl<TModelConstructor>,
  argsParam:
    | ConvertArgsParam<
        ExtractDefaultArgsFromModelConstructor<TModelConstructor>
      >
    | undefined,
  optional: boolean
): ExtractArgsFromModelConstructor<TModelConstructor> {
  return buildArgs(
    container.model.defaultArgs(),
    argsParam,
    optional
  ) as ExtractArgsFromModelConstructor<TModelConstructor>;
}
