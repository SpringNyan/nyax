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
    path: readonly string[]
  ) => void,
  path: string[] = []
): Record<string, unknown> {
  Object.keys(source).forEach((key) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }

    path.push(key);

    const sourceItem = source[key];
    if (isPlainObject(sourceItem)) {
      if (!(key in target)) {
        target[key] = {};
      }

      const targetItem = target[key];
      if (!isPlainObject(targetItem)) {
        throw new Error(`\`target["${key}"]\` is not an object`);
      }

      mergeObjects(targetItem, sourceItem, fn, path);
    } else {
      if (fn) {
        fn(sourceItem, key, target, path);
      } else {
        target[key] = sourceItem;
      }
    }

    path.pop();
  });

  return target;
}

export function flattenObject(
  obj: Record<string, unknown>,
  separator = "."
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  mergeObjects({}, obj, (item, _key, _target, path) => {
    result[path.join(separator)] = item;
  });
  return result;
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
