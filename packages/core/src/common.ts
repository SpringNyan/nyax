export const NYAX_NOTHING: unique symbol = "__nyax_nothing__" as any;

export class NyaxPromise<T> implements Promise<T> {
  public readonly [Symbol.toStringTag]: string;

  public hasRejectionHandler = false;

  private readonly _promise: Promise<T>;

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => void
  ) {
    this._promise = new Promise(executor);
  }

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    if (onrejected) {
      this.hasRejectionHandler = true;
    }

    return this._promise.then(onfulfilled, onrejected);
  }

  public catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null
  ): Promise<T | TResult> {
    if (onrejected) {
      this.hasRejectionHandler = true;
    }

    return this._promise.catch(onrejected);
  }

  public finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this._promise.finally(onfinally);
  }
}
