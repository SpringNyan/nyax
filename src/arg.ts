import { NYAX_NOTHING } from "./common";
import { ContainerImpl } from "./container";
import { ExtractModelArgs, ExtractModelDefaultArgs, Model } from "./model";
import { isObject } from "./util";

export const NYAX_REQUIRED_ARG_KEY: unique symbol = "__nyax_required_arg__" as any;
export const NYAX_DEFAULT_ARGS_KEY: unique symbol = "__nyax_default_args__" as any;

export interface RequiredArg<T = any> {
  [NYAX_REQUIRED_ARG_KEY]: true;
  defaultValue: T | typeof NYAX_NOTHING;
}

export interface ModelDefaultArgs {
  [key: string]: any | ModelInnerDefaultArgs;
}

export type ModelInnerDefaultArgs<
  TInnerDefaultArgs extends ModelDefaultArgs = ModelDefaultArgs
> = {
  [NYAX_DEFAULT_ARGS_KEY]: true;
} & TInnerDefaultArgs;

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
            [K in keyof TDefaultArgs]: TDefaultArgs[K] extends ModelInnerDefaultArgs<
              infer TInnerDefaultArgs
            >
              ? ConvertArgsParam<TInnerDefaultArgs>
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
        : TDefaultArgs[K] extends ModelInnerDefaultArgs<infer TInnerDefaultArgs>
        ? ConvertArgs<TInnerDefaultArgs>
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

export function isRequiredArg(obj: unknown): obj is RequiredArg {
  return (obj as RequiredArg | undefined)?.[NYAX_REQUIRED_ARG_KEY] === true;
}

export function isInnerDefaultArgs(obj: unknown): obj is ModelInnerDefaultArgs {
  return (
    (obj as ModelInnerDefaultArgs | undefined)?.[NYAX_DEFAULT_ARGS_KEY] === true
  );
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
      if (!isInnerDefaultArgs(defaultArgs[key])) {
        args[key] = argsParam[key];
      }
    });
  }

  Object.keys(defaultArgs).forEach((key) => {
    if (((key as any) as symbol) === NYAX_DEFAULT_ARGS_KEY || key in args) {
      return;
    }
    const defaultArg = defaultArgs[key];

    if (isInnerDefaultArgs(defaultArg)) {
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

export function createArgs<TModel extends Model>(
  container: ContainerImpl<TModel>,
  argsParam: ConvertArgsParam<ExtractModelDefaultArgs<TModel>> | undefined,
  optional: boolean
): ExtractModelArgs<TModel> {
  return buildArgs(
    container.modelInstance.defaultArgs(),
    argsParam,
    optional
  ) as ExtractModelArgs<TModel>;
}
