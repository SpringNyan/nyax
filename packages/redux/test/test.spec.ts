import { test as testDynamic } from "../../core/test/dynamic.spec";
import { test as testMerge } from "../../core/test/merge.spec";
import { test as testReload } from "../../core/test/reload.spec";
import { test as testStatic } from "../../core/test/static.spec";
import { createNyaxCreateStore } from "../src";

describe("@nyax/redux", () => {
  const options = {
    packageName: "@nyax/redux",
    createStore: createNyaxCreateStore({}),
  };

  testStatic(options);
  testDynamic(options);
  testMerge(options);
  testReload(options);
});
