import { debug, constants } from "../lib";

export function getMatchingNodes(documentOrNode, selector) {
  // Find all decendent nodes with a matching attribute
  const nodesToParse = [];
  nodesToParse.push(...documentOrNode.querySelectorAll(selector));
  const isDocument = documentOrNode instanceof Document;
  if (!isDocument && documentOrNode.matches(selector)) {
    // And include the node itself if it has a matching attribute
    nodesToParse.push(documentOrNode);
  }
  return nodesToParse;
}

export function getStatements(string, tagName) {
  // Split the strings passed to z-swap and z-action values.
  //
  // Return an object like:
  // [
  //   {
  //     trigger: 'click',
  //     modifiers: { outside: true, shift: true },
  //     handlerString: 'the action or swap text'
  //   }
  // ]
  //
  // Needs to handle multiple statements separated by ", @".
  // ...and also multiple triggers like "@[click,change] openModal"

  const statements = [];

  // First, split the statements by ", @"
  const statementStrings = string.split(/,\s*(?=@)/);
  for (const statementString of statementStrings) {
    // Split the trigger and handler string
    const match = statementString.match(/^(@\w+[\w\-\.]+|@\[[\w\-\.\,\s]+\])?(.*)/);
    // Reduce things like "@click" to "click" and "@[click, change]" to "click,change"
    // console.log("match[1]", match[1]);
    const triggerString = match[1] ? match[1].replace(/[@\[\]\s]/g, "") : "";
    // const triggerString = match[1].replaceAll(" ", "");
    // console.log("triggerString", triggerString);
    // Make sure handerString is trimmed or an empty string if undefined.
    const handlerString = match[2] ? match[2].trim() : "";
    // console.log("handlerString", handlerString);
    // Get the triggers array
    const triggersAndModifiers = getTriggers(triggerString, tagName);
    // console.log("triggersAndModifiers", triggersAndModifiers);
    for (const { trigger, modifiers } of triggersAndModifiers) {
      statements.push({ trigger, modifiers, handlerString });
    }
  }
  // console.log("statements", statements);
  return statements;
}

export function getDocumentOrWindow(modifiers) {
  if (modifiers.document) return document;
  if (modifiers.window || modifiers.outside) return window;
  return null;
}

export function processKeyboardModifiers({ trigger, modifiers, event }) {
  // Check for key modifiers?
  if (constants.keyboardEvents.includes(trigger)) {
    if (modifiers.shift && !event.shiftKey) return false;
    if (modifiers.ctrl && !event.ctrlKey) return false;
    if (modifiers.alt && !event.altKey) return false;
    if (modifiers.meta && !event.metaKey) return false;
    if (modifiers.keyName && event.key !== modifiers.keyName) return false;
  }
  return true;
}

export function processMouseModifiers({ trigger, modifiers, event }) {
  // Check for mouse modifiers?
  if (constants.mouseEvents.includes(trigger)) {
    if (modifiers.shift && !event.shiftKey) return false;
    if (modifiers.ctrl && !event.ctrlKey) return false;
    if (modifiers.alt && !event.altKey) return false;
    if (modifiers.meta && !event.metaKey) return false;
  }
  return true;
}

export function processOutsideModifiers({ modifiers, node, event }) {
  if (modifiers.outside) {
    if (node.contains(event.target)) return false;
  }
  return true;
}

export function processOnceModifiers({ modifiers, node }) {
  // Check for once modifier?
  if (node.hasFiredOnce) return false;
  if (modifiers.once) {
    node.hasFiredOnce = true;
  }
  return true;
}

export function processPreventOrStopModifiers({ modifiers, event }) {
  // Prevent default or stop propagation?
  if (modifiers.prevent) event.preventDefault();
  if (modifiers.stop) event.stopPropagation();
  return true;
}

export async function processDelayModifiers({ modifiers }) {
  // Check for timer modifiers?
  if (modifiers.delay) {
    await new Promise((resolve) => setTimeout(resolve, modifiers.delay));
  }
  return true;
}

export function prettyNodeName(documentOrNode) {
  return documentOrNode instanceof Document
    ? "#document"
    : "<" +
        documentOrNode.tagName.toLowerCase() +
        (documentOrNode.id ? "#" + documentOrNode.id : "") +
        ">";
}

export function debounce(func, delay) {
  let timeoutId;
  let resolveList = [];

  return function (...args) {
    // Clear the existing timeout
    clearTimeout(timeoutId);

    // Create a new promise and add its resolve function to the list
    const promise = new Promise((resolve) => {
      resolveList.push(resolve);
    });

    // Set a new timeout
    timeoutId = setTimeout(async () => {
      try {
        // Call the original async function and await its result
        const result = await func.apply(this, args);

        // Resolve all promises with the result
        resolveList.forEach((resolve) => resolve(result));
        resolveList = [];
      } catch (error) {
        // Reject all promises if an error occurs
        resolveList.forEach((resolve) => resolve(Promise.reject(error)));
        resolveList = [];
      }
    }, delay);

    // Return the promise
    return promise;
  };
}

export function attachMutationObserver(trigger, handler, node) {
  // Create a MutationObserver to watch for node removal
  // When the node is removed, remove the event listener
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      for (const removedNode of mutation.removedNodes) {
        if (removedNode === node || removedNode.contains(node)) {
          // Remove event listener when the node is removed from DOM
          node.removeEventListener(trigger, handler);
          zjax.debug &&
            debug(`Removing event listener for ${prettyNodeName(node)} (no longer in DOM)`);
          observer.disconnect(); // Stop observing
          return;
        }
      }
    }
  });

  // Observe the parent of the target node for childList changes
  observer.observe(document.body, { childList: true, subtree: true });
}

// Private
// -----------------------------------------------------------------------------
function getTriggers(triggerString, tagName) {
  // Takes a string like "click" or "click.delay.500ms,keydown.window.escape" and
  // returns an array like:
  //
  // [
  //   {
  //      trigger: 'click',
  //      modifiers: {
  //        delay: 500
  //      }
  //   },
  //   {
  //      trigger: 'keydown',
  //      modifiers: {
  //        window: true,
  //        keyName: 'escape'
  //      }
  //   },
  // ]

  // Return default?
  if (!triggerString) {
    return tagName === "FORM"
      ? [{ trigger: "submit", modifiers: {} }]
      : [{ trigger: "click", modifiers: {} }];
  }

  const triggers = [];
  // Loop through each trigger string (typically this an array of just one, like ['click'])
  // but sometimes something like ['click.delay.500ms','keydown.window.escape']
  for (const triggerStringPart of triggerString.split(",")) {
    triggers.push(getTriggerObject(triggerStringPart));
  }
  return triggers;
}

function getTriggerObject(triggerStringPart) {
  // Split a string like "click.outside.once" to get the trigger and modifiers
  const triggerStringParts = triggerStringPart.split(".");
  // The first part is the trigger and the rest are modifiers
  const trigger = triggerStringParts.shift();

  // We need to know if this is a keyboard or mouse event since those have special modifiers.
  const isMouseEvent = constants.mouseEvents.includes(trigger);
  const isKeyboardEvent = constants.keyboardEvents.includes(trigger);

  // For keyboard events, there's a slightly tricky situation because a modifier at least for the
  // keyName is absolutely required –– otherwise, if it were skipped, we might think the next arg
  // is the keyName like "keydown.window". So here's how we handle that: First, if you want to
  // listen for any key, use the "any" keyName like "keydown.any". We also want to allow for a
  // somewhat arbitrary order of modifiers like "keydown.prevent.shift.q".
  // So, we're start by setting the nextKey to "keyName" and then we'll set it to null after we've
  // either set the keyName or reached a known modifer that isn't a global trigger modifier or a
  // keyboard trigger modifier.
  const modifiers = {};
  let nextKey = isKeyboardEvent ? "keyName" : null;
  for (const part of triggerStringParts) {
    // console.log("part", part);
    // console.log("isMouseEvent", isMouseEvent);
    // console.log("isKeyboardEvent", isKeyboardEvent);

    // Is this a global trigger modifier?
    if (constants.globalTriggerModifiers.includes(part)) {
      modifiers[part] = true;
      continue;
    }

    // Is this a mouse trigger modifier?
    if (isMouseEvent && constants.mouseTriggerModifiers.includes(part)) {
      modifiers[part] = true;
      continue;
    }

    // Is this a boolean keyboard trigger modifier? (like shift, ctrl, alt, meta)
    if (isKeyboardEvent && constants.keyboardTriggerModifiers.includes(part)) {
      modifiers[part] = true;
      continue;
    }

    // For once modifiers, we'll let zactions/zswaps handle this
    if (part === "once") {
      modifiers[part] = part;
      continue;
    }

    // For outside modifiers, we'll let zactions/zswaps handle this

    if (part === "outside" && (isMouseEvent || isKeyboardEvent)) {
      modifiers[part] = part;
      continue;
    }

    // Since we haven't matched anything yet, maybe this is the keyName for a keyboard event?
    if (isKeyboardEvent && nextKey === "keyName") {
      // If this is a named key like "escape" or "arrowup", we'll get it from the namedKeyMap.
      modifiers[nextKey] = constants.namedKeyMap[part] || part;
      nextKey = null;
      continue;
    }

    // Is this a timer trigger modifier?
    if (constants.timerTriggerModifiers.includes(part)) {
      nextKey = part;
      continue;
    }

    // Is there a key waiting to be set from previous loop?
    if (nextKey) {
      // Is this a timer trigger value?
      if (constants.timerTriggerModifiers.includes(nextKey)) {
        const isSeconds = part.match(/\d+s/);
        const isMilliseconds = part.match(/\d+ms/);
        if (!isSeconds && !isMilliseconds) {
          throw new Error(`Invalid timer value: ${part}`);
        }
        // Set value like { debounce: 500 }
        modifiers[nextKey] = isSeconds
          ? parseInt(isSeconds[0]) * 1000
          : parseInt(isMilliseconds[0]);
        nextKey = null;
        continue;
      }
    }

    // If we've reached this point, we don't know what to do with this modifier.
    throw new Error(`Unknown trigger modifier in this context: ${part}`);
  }

  return {
    trigger,
    modifiers,
  };
}
