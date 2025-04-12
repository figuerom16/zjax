// Both zswaps and zactions will use this to add event listeners to the DOM.
// and also keep track of the listeners so we can remove them.
//
// Dev Note: Modifiers like much of the system make use of the "trigger" object
// (see lib/triggers.js for more info).
//
// Processing modifiers and calling the handler function is mostly the same for
// swaps and actions with one important exeption: Swaps do not need the $ object
// but actions do. So we need to pass the $ object to the handler function only for actions.

import { getDollar, modifiers, utils } from "../lib";

export function addZjaxListener(trigger, handlerFunction, withDollar = false) {
  trigger.target.addEventListener(trigger.event, async function (event) {
    // Process modifiers
    if (!modifiers.processKeyboard(trigger, event)) return;
    if (!modifiers.processMouse(trigger, event)) return;
    if (!modifiers.processOutside(trigger, event)) return;
    if (!modifiers.processOnce(trigger, event)) return;
    if (!modifiers.processPreventOrStop(trigger, event)) return;
    if (!(await modifiers.processDelay(trigger, event))) return;

    const eventOrDollar = withDollar ? getDollar(trigger.node, event) : event;

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
