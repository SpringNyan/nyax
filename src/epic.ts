import { Epic } from "redux-observable";
import { AnyAction } from "./action";

export interface Epics {
  [key: string]: Epic<AnyAction, AnyAction, unknown> | Epics;
}
