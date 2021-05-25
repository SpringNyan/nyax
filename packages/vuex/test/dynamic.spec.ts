import { test } from "../../core/test/dynamic.spec";
import { createNyaxCreateStore } from "../src";

test({
  packageName: "@nyax/vuex",
  createStore: createNyaxCreateStore({}),
});
