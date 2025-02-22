import { getGlobalZjax, parseZSwaps, parseZActions, debug } from "./lib.js";
// import * as zactions from "./zactions.js";

// Create a global zjax object for setting config, and registering JS ations.
window.zjax = getGlobalZjax();

// Parse the DOM on load.
document.addEventListener("DOMContentLoaded", () => {
  debug("Parsing DOM");
  parseZSwaps(document);
  parseZActions(document);

  // Also reparse the DOM when specified events occur.
  const parseOnEvents = Array.isArray(window.zjax.parseOn)
    ? window.zjax.parseOn
    : [window.zjax.parseOn];

  for (const event of parseOnEvents) {
    document.addEventListener(event, () => {
      debug("Reparsing DOM on", event);
      parseZSwaps(document);
      parseZActions(document);
    });
  }
});
