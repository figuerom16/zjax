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
    const promise = new Promise((resolve, reject) => {
      resolveList.push({ resolve, reject });
    });

    // Set a new timeout
    timeoutId = setTimeout(async () => {
      try {
        // Call the original async function and await its result
        const result = await func.apply(this, args);

        // Resolve all promises with the result
        resolveList.forEach(({ resolve }) => resolve(result));
        resolveList = [];
      } catch (error) {
        // Reject all promises if an error occurs
        resolveList.forEach(({ reject }) => reject(error));
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
