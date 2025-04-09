// Both zswaps and zactions will use this to add event listeners to the DOM.
// and also keep track of the listeners so we can remove them.

import * as utils from "./utils.js";

export function addZjaxListener(trigger, handlerFunction) {
  trigger.target.addEventListener(trigger.event, async function (event) {
    // Process modifiers
    if (!utils.processKeyboardModifiers({ ...trigger, event })) return;
    if (!utils.processMouseModifiers({ ...trigger, event })) return;
    if (!utils.processOutsideModifiers({ ...trigger, event })) return;
    if (!utils.processOnceModifiers({ ...trigger, event })) return;
    if (!utils.processPreventOrStopModifiers({ ...trigger, event })) return;
    if (!(await utils.processDelayModifiers({ ...trigger, event }))) return;

    if (trigger.modifiers.debounce) {
      const debouncedHandler = utils.debounce(handlerFunction, trigger.modifiers.debounce);
      await debouncedHandler(event);
    } else {
      await handlerFunction(event);
    }
  });

  // Add a mutation observer to remove the event listener when the node is removed
  utils.attachMutationObserver(trigger.event, handlerFunction, trigger.node);

  // Todo: update this to use custom "mount" event
  // if (trigger === "zjax:load") {
  //   node.dispatchEvent(new CustomEvent("zjax:load"));
  // }
}

export function removeAllZjaxListeners() {
  //
}
