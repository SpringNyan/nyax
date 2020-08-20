export type Spread<T> = {
  "0": { [K in keyof T]: T[K] };
}["0"];

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends ((...args: any[]) => any) | any[]
    ? T[K]
    : DeepPartial<T[K]>;
};

export interface DeepRecord<T> {
  [key: string]: T | DeepRecord<T>;
}

export function is(x: unknown, y: unknown): boolean {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}

export function isObject(obj: unknown): obj is Record<string, unknown> {
  return obj != null && typeof obj === "object" && !Array.isArray(obj);
}

export function mergeObjects<T>(
  target: DeepRecord<T>,
  source: DeepRecord<T>,
  fn?: (
    item: T,
    key: string,
    parent: DeepRecord<T>,
    paths: readonly string[]
  ) => void,
  paths: string[] = []
): DeepRecord<T> {
  if (!isObject(target)) {
    throw new Error("target is not an object");
  }

  if (!isObject(source)) {
    throw new Error("source is not an object");
  }

  Object.keys(source).forEach((key) => {
    if (key === "__proto__") {
      return;
    }

    paths.push(key);

    const sourceItem = source[key];
    if (isObject(sourceItem)) {
      if (target[key] === undefined) {
        target[key] = {};
      }

      const targetItem = target[key];
      mergeObjects(
        targetItem as Record<string, T>,
        sourceItem as Record<string, T>,
        fn,
        paths
      );
    } else {
      if (fn) {
        fn(sourceItem as T, key, target, paths);
      } else {
        target[key] = sourceItem;
      }
    }

    paths.pop();
  });

  return target;
}

export function traverseObject<T>(
  obj: DeepRecord<T>,
  fn: (
    item: T,
    key: string,
    parent: DeepRecord<T>,
    paths: readonly string[]
  ) => void
): void {
  mergeObjects(obj, obj, fn);
}

export function flattenObject<T>(
  obj: DeepRecord<T>,
  separator = "."
): Record<string, T> {
  const result: Record<string, T> = {};

  traverseObject(obj, (item, key, parent, paths) => {
    result[paths.join(separator)] = item;
  });

  return result;
}

export function convertNamespaceToPath(namespace: string): string {
  return namespace.replace(/\//g, ".");
}

export function joinLastString(
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

export function defineGetter<TObject, TKey extends keyof TObject>(
  obj: TObject,
  p: TKey,
  get: () => TObject[TKey]
): void {
  Object.defineProperty(obj, p, {
    get,
    enumerable: false,
    configurable: true,
  });
}

export function findLastIndex<T>(arr: T[], fn: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; --i) {
    if (fn(arr[i])) {
      return i;
    }
  }
  return -1;
}
