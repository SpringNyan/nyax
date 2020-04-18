import { Epic } from "redux-observable";
import { merge, Observable } from "rxjs";
import { catchError, filter, takeUntil } from "rxjs/operators";
import { AnyAction, batchUnregisterActionHelper } from "./action";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { traverseObject } from "./util";

export interface Epics {
  [key: string]: (() => Observable<AnyAction>) | Epics;
}

export function createEpic(
  nyaxContext: NyaxContext,
  container: ContainerImpl
): Epic {
  return (rootAction$, rootState$): Observable<AnyAction> => {
    // TODO

    const outputObservables: Array<Observable<AnyAction>> = [];
    traverseObject(container.epics, (epic: () => Observable<AnyAction>) => {
      outputObservables.push(
        epic().pipe(
          catchError((error, caught) => {
            nyaxContext.onUnhandledEpicError(error);
            return caught;
          })
        )
      );
    });

    const takeUntil$ = rootAction$.pipe(
      filter((action) => {
        if (batchUnregisterActionHelper.is(action)) {
          return action.payload.some(
            (payload) =>
              payload.modelNamespace === container.modelNamespace &&
              payload.containerKey === container.containerKey
          );
        } else {
          return false;
        }
      })
    );

    return merge(...outputObservables).pipe(takeUntil(takeUntil$));
  };
}
