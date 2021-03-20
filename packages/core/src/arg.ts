import { NYAX_NOTHING } from "./common";
import { ContainerImpl } from "./container";
import { ExtractModelArgs, ExtractModelDefaultArgs, Model } from "./model";
import { isObject } from "./util";

export const NYAX_REQUIRED_ARG: unique symbol = "__nyax_required_arg__" as any;
export const NYAX_DEFAULT_ARGS: unique symbol = "__nyax_default_args__" as any;

export interface RequiredArg<T = unknown> {
  [NYAX_REQUIRED_ARG]: true;
  defaultValue: T | typeof NYAX_NOTHING;
}

export interface ModelDefaultArgs {
  [key: string]: unknown | RequiredArg | ModelInnerDefaultArgs;
}

export interface ModelInnerDefaultArgsBase {
  [NYAX_DEFAULT_ARGS]: true;
}

export type ModelInnerDefaultArgs<
  TInnerDefaultArgs extends ModelDefaultArgs = ModelDefaultArgs
> = ModelInnerDefaultArgsBase & TInnerDefaultArgs;

export type ConvertRegisterArgs<
  TDefaultArgs
> = TDefaultArgs extends infer TDefaultArgs
  ? {
      [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg<any>
        ? K
        : never;
    }[keyof TDefaultArgs] extends infer TRequiredKey
    ? {
        [K in keyof TDefaultArgs]: TDefaultArgs[K] extends RequiredArg<infer T>
          ? T
          : TDefaultArgs[K] extends ModelInnerDefaultArgs<
              infer TInnerDefaultArgs
            >
          ? ConvertRegisterArgs<TInnerDefaultArgs>
          : TDefaultArgs[K];
      } extends infer TArgs
      ? Pick<TArgs, Extract<keyof TArgs, TRequiredKey>> &
          Partial<Pick<TArgs, Exclude<keyof TArgs, TRequiredKey>>>
      : never
    : never
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
    [NYAX_REQUIRED_ARG]: true,
    defaultValue: arguments.length > 0 ? (defaultValue as T) : NYAX_NOTHING,
  };
}

export function isRequiredArg(obj: unknown): obj is RequiredArg {
  return (obj as RequiredArg | undefined)?.[NYAX_REQUIRED_ARG] === true;
}

export function isModelInnerDefaultArgs(
  obj: unknown
): obj is ModelInnerDefaultArgs {
  return (
    (obj as ModelInnerDefaultArgs | undefined)?.[NYAX_DEFAULT_ARGS] === true
  );
}

export function buildArgs<TDefaultArgs extends ModelDefaultArgs>(
  defaultArgs: TDefaultArgs,
  registerArgs: ConvertRegisterArgs<TDefaultArgs> | undefined,
  optional: boolean
): ConvertArgs<TDefaultArgs> {
  if (!isObject(defaultArgs)) {
    throw new Error("Default args is not an object");
  }

  const args: Record<string, unknown> = {};

  if (registerArgs) {
    Object.keys(registerArgs).forEach((key) => {
      if (!isModelInnerDefaultArgs(defaultArgs[key])) {
        args[key] = registerArgs[key];
      }
    });
  }

  Object.keys(defaultArgs).forEach((key) => {
    if ((key as keyof any) === NYAX_DEFAULT_ARGS || key in args) {
      return;
    }
    const defaultArg = defaultArgs[key];

    if (isModelInnerDefaultArgs(defaultArg)) {
      args[key] = buildArgs(
        defaultArg,
        registerArgs?.[key] as
          | ConvertRegisterArgs<ModelDefaultArgs>
          | undefined,
        optional
      );
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
  registerArgs:
    | ConvertRegisterArgs<ExtractModelDefaultArgs<TModel>>
    | undefined,
  optional: boolean
): ExtractModelArgs<TModel> {
  return buildArgs(
    container.modelInstance.defaultArgs(),
    registerArgs,
    optional
  ) as ExtractModelArgs<TModel>;
}
