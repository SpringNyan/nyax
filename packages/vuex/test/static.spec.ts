import { test } from "../../core/test/static.spec";
import { createNyaxCreateStore } from "../src";

test({
  packageName: "@nyax/vuex",
  createStore: createNyaxCreateStore({}),
});
