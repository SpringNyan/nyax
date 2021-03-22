import { Epic } from "redux-observable";
import { merge, Observable } from "rxjs";
import { catchError, filter, takeUntil } from "rxjs/operators";
import { AnyAction, unregisterActionHelper } from "./action";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { traverseObject } from "./util";

export type ModelEpic = () => Observable<AnyAction>;

export interface ModelEpics {
  [key: string]: ModelEpic | ModelEpics;
}

export function createEpic(
  nyaxContext: NyaxContext,
  container: ContainerImpl
): Epic {
  return () => {
    const outputObservables: Observable<AnyAction>[] = [];
    traverseObject(container.epics, (epic: ModelEpic) => {
      outputObservables.push(
        epic().pipe(
          catchError((error, caught) => {
            return nyaxContext.onUnhandledEpicError(error, caught);
          })
        )
      );
    });

    const takeUntil$ = nyaxContext.rootAction$.pipe(
      filter((action) => {
        if (unregisterActionHelper.is(action)) {
          return action.payload.some(
            (payload) =>
              payload.namespace === container.modelNamespace &&
              payload.key === container.containerKey
          );
        } else {
          return false;
        }
      })
    );

    return merge(...outputObservables).pipe(takeUntil(takeUntil$));
  };
}
