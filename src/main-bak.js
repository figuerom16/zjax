import { getGlobalZjax, parseZSwaps, parseZActions, debug } from "./lib";
// import * as zactions from "./zactions.js";

// Create a global zjax object for setting config, and registering JS ations.
window.zjax = getGlobalZjax();

// Parse the DOM on load.
document.addEventListener("DOMContentLoaded", () => {
  // Regular mode
  if (!zjax.hotwire) {
    debug("Parsing DOM");
    parseZSwaps(document);
    parseZActions(document);
  }

  // Hotwire mode (listen for turbo:load events instead)
  if (zjax.hotwire) {
    document.addEventListener("turbo:load", () => {
      debug("Parsing DOM on turbo:load");
      parseZSwaps(document);
      parseZActions(document);
    });
  }

  // Also reparse the DOM when specified events occur.
  const parseOnEvents = Array.isArray(window.zjax.parseOn)
    ? window.zjax.parseOn
    : [window.zjax.parseOn];

  for (const event of parseOnEvents) {
    document.addEventListener(event, () => {
      debug("Parsing DOM on event", event);
      parseZSwaps(document);
      parseZActions(document);
    });
  }
});
