export type Simplify<T> = {
  "0": { [K in keyof T]: T[K] };
}["0"];

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export function is(x: unknown, y: unknown): boolean {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}

export function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return obj != null && typeof obj === "object" && !Array.isArray(obj);
}

export function mergeObjects(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  fn?: (
    item: unknown,
    key: string,
    target: Record<string, unknown>,
    paths: readonly string[]
  ) => void,
  paths: string[] = []
): Record<string, unknown> {
  if (!isPlainObject(target)) {
    throw new Error("`target` is not an object.");
  }

  if (!isPlainObject(source)) {
    throw new Error("`source` is not an object.");
  }

  Object.keys(source).forEach(function (key) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }

    paths.push(key);

    const sourceItem = source[key];
    if (isPlainObject(sourceItem)) {
      if (!(key in target)) {
        target[key] = {};
      }

      const targetItem = target[key];
      if (!isPlainObject(targetItem)) {
        throw new Error('`target["${key}"]` is not an object.');
      }

      mergeObjects(targetItem, sourceItem, fn, paths);
    } else {
      if (fn) {
        fn(sourceItem, key, target, paths);
      } else {
        target[key] = sourceItem;
      }
    }

    paths.pop();
  });

  return target;
}

export function flattenObject(
  obj: Record<string, unknown>,
  separator = "."
): Record<string, unknown> {
  return mergeObjects({}, obj, function (item, _key, target, paths) {
    target[paths.join(separator)] = item;
  });
}

export function concatLastString(
  str: string,
  lastStr: string | undefined,
  separator = "/"
): string {
  if (!lastStr) {
    return str;
  }

  if (!str) {
    return lastStr;
  }

  return `${str}${separator}${lastStr}`;
}

export function splitLastString(
  str: string,
  separator = "/"
): [string, string] {
  const index = str.lastIndexOf(separator);
  return index >= 0
    ? [str.substring(0, index), str.substring(index + 1)]
    : ["", str];
}

export function defineGetter(o: object, p: string, get: () => unknown): void {
  Object.defineProperty(o, p, {
    get,
    enumerable: false,
    configurable: true,
  });
}

export function asType<T>(_value: unknown): asserts _value is T {
  return;
}
