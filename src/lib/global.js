import { parseSwaps, parseActions } from "../lib";

export function getGlobal() {
  return {
    debug: false,
    transitions: true,
    parse: function () {
      // Parse the DOM for zjax elements
      parseSwaps(document);
      parseActions(document);
    },
    actions: {},
  };
}
