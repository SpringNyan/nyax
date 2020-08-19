import { Epic } from "redux-observable";
import { merge, Observable } from "rxjs";
import { catchError, takeUntil } from "rxjs/operators";
import { AnyAction } from "./action";
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

    const takeUntil$ = new Observable((subscribe) => {
      container.modelContext.stopEpicEmitterByContainerKey.set(
        container.containerKey,
        () => {
          subscribe.next(true);
          subscribe.complete();
        }
      );
    });

    return merge(...outputObservables).pipe(takeUntil(takeUntil$));
  };
}
