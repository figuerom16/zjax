import { parseSwaps, parseActions } from "../lib";

export function getGlobal() {
  return {
    debug: false,
    transitions: true,
    actions: {},
    errors: {},
    parse: function () {
      // Parse the DOM for zjax elements
      parseSwaps(document);
      parseActions(document);
    },
  };
}
