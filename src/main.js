import { getGlobal, parseSwaps, parseActions, removeAllZjaxListeners, debug } from "./lib";
// import * as zactions from "./lib/zactions.js";

// Create a global zjax object for setting config, and registering JS ations.

window.zjax = getGlobal();

// Parse the DOM on load.
debug("Parsing DOM on document load");
parseSwaps(document);
parseActions(document);

// Listen for Hotwire turbo:load events
document.addEventListener("turbo:load", () => {
  debug("Parsing DOM on turbo:load");
  removeAllZjaxListeners();
  parseSwaps(document);
  parseActions(document);
});
