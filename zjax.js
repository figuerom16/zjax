// Create a global zjax object for setting config, and registering JS ations.
window.zjax = getGlobalZjaxObject();

// Constants
const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const swapTypes = [
  "outer",
  "inner",
  "before",
  "after",
  "prepend",
  "append",
  "none",
  "delete",
];
const isVTSupported = document.startViewTransition !== undefined;
// Parse the DOM on load.
addEventListener("DOMContentLoaded", function () {
  debug("Parsing DOM");
  parseZSwaps(document);
});

function getGlobalZjaxObject() {
  return {
    debug: false,
    transitions: true,
    zjaxActions: {}, // Defaults that take args? like zjax.remove('#foo')
    userActions: {},
    actions: function (arg1, arg2) {
      // Usage:
      // zjax.register({
      //   openPanel($) {
      //     console.log('openPanel called by node', $.node);
      //   }
      // })
      // An optional namespace can be specified as arg1 so that userActions
      // can be called like z-action="books.closePanel"
      const namespace = arg2 ? arg1 : null;
      if (namespace === "zjax") {
        throw new Error("'zjax' is a reserved actions namespace");
      }
      const object = arg2 ? arg2 : arg1;
      let userActionsTarget;
      if (namespace) {
        this.userActions[namespace] = {};
        userActionsTarget = this.userActions[namespace];
      } else {
        userActionsTarget = this.userActions;
      }
      Object.keys(object).forEach(function (name) {
        const actionFunction = object[name];
        userActionsTarget[name] = actionFunction;
      });
    },
  };
}

async function parseZSwaps(documentOrNode) {
  const zSwapNodes = getMatchingNodes(documentOrNode, "[z-swap]");
  debug(
    `Found ${zSwapNodes.length} z-swap nodes in ${prettyNodeName(
      documentOrNode
    )}`
  );
  for (const node of zSwapNodes) {
    try {
      zSwapString = node.getAttribute("z-swap");
      const zSwapObject = getZSwapObject(zSwapString, node);
      // Add the swap function listener to the node
      const zSwapFunction = getZSwapFunction(zSwapObject, node);
      attachEventListener(zSwapObject.trigger, zSwapFunction, node);
      attachMutationObserver(zSwapObject.trigger, zSwapFunction, node);
      zjax.debug &&
        debug(
          `Added z-swap for '${zSwapObject.trigger}' events to ${prettyNodeName(
            node
          )}`
        );
    } catch (error) {
      console.error(
        `ZJAX ERROR – Unable to parse z-swap: ${error.message}\n`,
        node
      );
    }
  }
}

// Helper functions

function getZSwapObject(zSwapString, node) {
  const valueString = collapseCommas(zSwapString);
  // Split on whitespace
  const valueParts = valueString.split(/\s/);
  if (valueParts.length < 1 || valueParts.length > 4) {
    throw new Error("Must have between 1 and 4 parts separated by spaces.");
  }

  // Loop through space-separated parts of the z-swap attribute to build the zSwapObject object
  const zSwapObject = {};
  const leftoverParts = [];

  while (valueParts.length > 0) {
    const part = valueParts.shift();
    const typeAndValue = getTriggerMethodOrEndpointPair(part);
    if (typeAndValue) {
      zSwapObject[typeAndValue[0]] = typeAndValue[1];
    } else {
      leftoverParts.push(part);
    }
  }

  // Add the array of swaps
  zSwapObject.swaps = getSwaps(leftoverParts.join(" "));

  // Now set defaults for missing values.
  if (!zSwapObject.trigger) {
    zSwapObject.trigger = node.tagName === "FORM" ? "submit" : "click";
  }
  if (!zSwapObject.method) {
    zSwapObject.method = node.tagName === "FORM" ? "POST" : "GET";
  }
  if (!zSwapObject.endpoint) {
    if (node.tagName === "FORM") {
      zSwapObject.endpoint = node.action;
    } else if (node.tagName === "A") {
      zSwapObject.endpoint = node.href;
    } else {
      throw new Error("No endpoint inerrable or specified");
    }
  }
  return zSwapObject;
}

function getTriggerMethodOrEndpointPair(swapSpecifier) {
  // Is this a Trigger?
  if (swapSpecifier.startsWith("@")) {
    return ["trigger", swapSpecifier.substr(1)];
  }
  // Is this an HTTP Method?
  if (httpMethods.includes(swapSpecifier.toUpperCase())) {
    return ["method", swapSpecifier.toUpperCase()];
  }
  // Is this an Endpoint?
  //...is a ".", or starts with "/", "./", "http://", or "https://"
  regexEndpoint = /^(\/.*|\.\/.*|https?:\/\/.*|\.)$/;
  if (regexEndpoint.test(swapSpecifier)) {
    return ["endpoint", swapSpecifier];
  }
}

function prettyNodeName(documentOrNode) {
  return documentOrNode instanceof Document
    ? "#document"
    : "<" +
        documentOrNode.tagName.toLowerCase() +
        (documentOrNode.id ? "#" + documentOrNode.id : "") +
        ">";
}

function getMatchingNodes(documentOrNode, selector) {
  // Find all decendent nodes with a z-swap attribute
  const nodesToParse = [];
  nodesToParse.push(...documentOrNode.querySelectorAll(selector));
  const isDocument = documentOrNode instanceof Document;
  if (!isDocument && documentOrNode.matches(selector)) {
    // And include the node itself if it has a z-swap attribute
    nodesToParse.push(documentOrNode);
  }
  return nodesToParse;
}

function getSwaps(swapString) {
  // Parse a  like: "foo->#bar|inner, #baz" into an array of objects
  // [
  //   { response: "foo", target: "#bar", swapStringType: "inner" },
  //   { response: "#baz", target: "#baz", swapType: "outer" }
  // ]
  const swaps = [];
  swapString.split(",").forEach(function (swapPart) {
    const swap = {};
    const responseAndTargetSwaps = swapPart.split("->");
    const targetAndSwapType = responseAndTargetSwaps.pop();
    const [targetNode, swapType] = targetAndSwapType.split("|");
    const responseNode = responseAndTargetSwaps[0] || targetNode;
    swap["response"] = responseNode;
    swap["target"] = targetNode;
    swap["swapType"] = swapType || "outer";
    if (swap["swapType"] && !swapTypes.includes(swap["swapType"])) {
      throw new Error(`Invalid swap type: ${swap["swapType"]}`);
    }
    swaps.push(swap);
  });
  return swaps;
}

function getZSwapFunction(zSwap, node) {
  return async function (event) {
    event.preventDefault();
    event.stopPropagation();
    debug("z-swap triggered for", zSwap);
    // Call the action
    try {
      const responseDOM = await getResponseDOM(zSwap.method, zSwap.endpoint);
      // Swap nodes
      zSwap.swaps.forEach(function (swap) {
        // Get the source and target nodes
        const [responseNode, targetNode] = getNewAndOldNodes(responseDOM, swap);
        // Before swapping in a source node, parse it for z-swaps
        debug(`Parsing incoming response for z-swaps`);
        parseZSwaps(responseNode);
        // Swap the node using a view transition?
        if (isVTSupported && zjax.transitions) {
          document.startViewTransition(() => {
            swapOneNode(targetNode, responseNode, swap.swapType);
          });
        } else {
          swapOneNode(targetNode, responseNode, swap.swapType);
        }
      });
    } catch (error) {
      console.error(
        `ZJAX ERROR – Unable to execute z-swap function: ${error.message}\n`,
        node,
        error.stack
      );
    }
  };
}

async function getResponseDOM(method, endpoint) {
  // Get formData?
  // const body = ?? # TODO
  const response = await fetch(endpoint, {
    method: method,
    body: null,
  });
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText} for ${endpoint}`
    );
    // Todo: Think of some way to let the developer handle
    // this error to show a message to the useras an alert
    // notice. Maybe just trigger a zjax-error event?
  }
  const responseDOM = new DOMParser().parseFromString(
    await response.text(),
    "text/html"
  );
  debug(`z-swap response from ${endpoint} received and parsed`);
  return responseDOM;
}

function getNewAndOldNodes(responseDOM, swap) {
  let targetNode;
  let responseNode;

  if (swap.target === "*") {
    // It isn't possible to use JS to replace the entire document
    // so we'll treat '*' as an alias for 'body'
    targetNode = document.querySelector("body");
    if (!targetNode) {
      throw new Error("Unable to find body element in local DOM to swap into");
    }
  } else {
    targetNode = document.querySelector(swap.target);
  }

  responseNode =
    swap.response === "*"
      ? responseDOM
      : responseDOM.querySelector(swap.response);

  // Make sure there's a valid target node for all swap types except "none"
  if (!targetNode && swap.swapType !== "none") {
    throw new Error(`Target node '${swap.target}' does not exist in local DOM`);
  }

  // Make sure there's a valid response node for all swap types except "none" or "delete"
  if (!responseNode && swap.swapType !== "none" && swap.swapType !== "delete") {
    throw new Error(
      `Source node ${swap.response} does not exist in response DOM`
    );
  }

  return [responseNode, targetNode];
}

function swapOneNode(targetNode, responseNode, swapType) {
  // Since a responseNode might be a single node or a whole document (which may just contain
  // a handful of nodes), let's just normalize all responseNodes to be an array.
  const responseNodes = normalizeNodeList(responseNode);

  // Outer
  if (swapType === "outer") {
    const targetNodeParent = targetNode.parentNode;
    responseNodes.forEach((item) => {
      targetNodeParent.insertBefore(item, targetNode);
    });
    targetNodeParent.removeChild(targetNode);
    return;
  }

  // Inner
  if (swapType === "inner") {
    targetNode.textContent = "";
    responseNodes.forEach((item) => {
      targetNode.appendChild(item);
    });
    return;
  }

  // Before
  if (swapType === "before") {
    responseNodes.forEach((item) => {
      targetNode.parentNode.insertBefore(item, targetNode);
    });
    return;
  }

  // After
  if (swapType === "after") {
    const parentNode = targetNode.parentNode;
    referenceNodeToAppendTo = targetNode;
    responseNodes.forEach((item) => {
      if (item === parentNode.lastChild) {
        parentNode.appendChild(item);
      } else {
        parentNode.insertBefore(item, referenceNodeToAppendTo.nextSibling); // Otherwise, insert after the reference node
      }
      referenceNodeToAppendTo = item;
    });
    return;
  }

  // Prepend
  if (swapType === "prepend") {
    const firstChild = targetNode.firstChild;
    responseNodes.forEach((item) => {
      if (firstChild) {
        targetNode.insertBefore(item, firstChild);
      } else {
        targetNode.appendChild(item);
      }
    });
    return;
  }

  // Append
  if (swapType === "append") {
    responseNodes.forEach((item) => {
      targetNode.appendChild(item);
    });
    return;
  }

  // Delete
  if (swapType === "delete") {
    targetNode.remove();
    return;
  }

  // None
  if (swapType === "none") {
    return;
  }
}

function normalizeNodeList(node) {
  // Is the reponse a full HTML document?
  if (node instanceof Document) {
    // Is there an HTML element in the document?
    const htmlNode = node.querySelector("html");
    if (htmlNode) {
      return Array.from(htmlNode.childNodes);
    }
    // Otherwise, create a document fragment and return all child nodes
    const fragment = document.createDocumentFragment();
    for (const child of node.childNodes) {
      fragment.appendChild(child);
    }
    return Array.from(fragment.childNodes);
  }

  // Is the response a NodeList?
  if (node instanceof NodeList || Array.isArray(node)) {
    return Array.from(node);
  }

  // For a single node, just return as an array
  return [node];
}

function attachEventListener(trigger, handler, node) {
  node.addEventListener(trigger, handler);
}

function attachMutationObserver(trigger, handler, node) {
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
                node
              )} (no longer in DOM)`
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

function collapseCommas(str) {
  // If commas have spaces next to them, remove those spaces.
  return str.replace(/\s*,\s*/g, ",");
}

function debug() {
  if (!zjax.debug) {
    return;
  }
  console.log("ZJAX DEBUG:", ...arguments);
}
