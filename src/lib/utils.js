import { debug } from "../lib.js";

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
  // Return an array of objects like:
  // [
  //   {
  //     trigger, 'click',
  //     handlerString, 'the action or swap text'
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
    const match = statementString.match(/^(@\w+|@\[[^\]]+\])?(.*)/);
    const triggerString = match[1] ? match[1].replace(/@\[\s\]/) : "";
    const handlerString = match[2] ? match[2].trim() : "";
    // Get the triggers array
    const triggers = getTriggers(triggerString, tagName);
    for (const trigger of triggers) {
      statements.push({ trigger, handlerString });
    }
  }
  return statements;
}

// Private
function getTriggers(triggerString, tagName) {
  // Takes a string like @click, @[click,mouseover], or a null value
  // and returns an array like ["click"], ["click", "mouseover"], or ["submit"]

  // Return default?
  if (!triggerString) {
    return tagName === "FORM" ? ["submit"] : ["click"];
  }

  // Strip @, brackets, and whitespace, then split by commas
  const cleanedTriggerString = triggerString.replace(/[@\[\s+\]]/g, "");
  return cleanedTriggerString.split(",");
}

export function prettyNodeName(documentOrNode) {
  return documentOrNode instanceof Document
    ? "#document"
    : "<" +
        documentOrNode.tagName.toLowerCase() +
        (documentOrNode.id ? "#" + documentOrNode.id : "") +
        ">";
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
            debug(
              `Removing event listener for ${prettyNodeName(
                node,
              )} (no longer in DOM)`,
            );
          observer.disconnect(); // Stop observing
          return;
        }
      }
    }
  });

  // Observe the parent of the target node for childList changes
  observer.observe(document.body, { childList: true, subtree: true });
}
