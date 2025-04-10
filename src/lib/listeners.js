// Both zswaps and zactions will use this to add event listeners to the DOM.
// and also keep track of the listeners so we can remove them.
//
// Dev Note: Modifiers like much of the system make use of the "trigger" object
// (see lib/triggers.js for more info).
//
// Processing modifiers and calling the handler function is mostly the same for
// swaps and actions with one important exeption: Swaps do not need the $ object
// but actions do. So we need to pass the $ object to the handler function only for actions.

import { modifiers, utils } from "../lib";

export function addZjaxListener(trigger, handlerFunction, with$ = false) {
  trigger.target.addEventListener(trigger.event, async function (event) {
    // Process modifiers
    if (!modifiers.processKeyboard(trigger, event)) return;
    if (!modifiers.processMouse(trigger, event)) return;
    if (!modifiers.processOutside(trigger, event)) return;
    if (!modifiers.processOnce(trigger, event)) return;
    if (!modifiers.processPreventOrStop(trigger, event)) return;
    if (!(await modifiers.processDelay(trigger, event))) return;

    const eventOrDollar = with$ ? get$(trigger.node, event) : event;

    if (modifiers.debounce) {
      const debouncedHandler = modifiers.debounce(handlerFunction, trigger.modifiers.debounce);
      debouncedHandler(eventOrDollar);
      return;
    }
    await handlerFunction(eventOrDollar);
  });

  // Add a mutation observer to remove the event listener when the node is removed
  utils.attachMutationObserver(trigger.event, handlerFunction, trigger.node);
}

export function removeAllZjaxListeners() {
  // Todo
}

function get$(node, event) {
  const $ = new Proxy(function () {}, {
    apply(_target, thisArg, args) {
      // This is where the function is called like $('nav > a.active')
      if (args.length === 0) {
        return node;
      }
      if (args.length === 1) {
        const node = document.querySelector(args[0]);
        if (!node) {
          throw new Error(`$('${args[0]}') did not match any elements in the DOM.`);
        }
        return node;
      }
      throw new Error("$() can be called with a maximum of one argument.");
    },
    get(target, prop) {
      if (prop === "event") {
        return target.event;
      }
      if (prop === "all") {
        return function (selector) {
          return document.querySelectorAll(selector);
        };
      }
    },
  });
  $.event = event;
  return $;
}
