import { createModelDefinition } from "../../src";
import { dependencies } from "../dependencies";

export const baseModelDef = createModelDefinition({
  selectors: {
    dependencies() {
      return dependencies;
    },
  },
});
