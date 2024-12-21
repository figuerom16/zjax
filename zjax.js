// Create a global zjax object for setting config, and registering JS ations.
window.zjax = getGlobalZjaxObject();

// Constants
const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
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

function parseZSwaps(documentOrNode) {
  const zSwapNodes = getMatchingNodes(documentOrNode, "[z-swap]");
  debug(
    `Found ${zSwapNodes.length} z-swap nodes in ${prettyNodeName(
      documentOrNode
    )}`
  );
  zSwapNodes.forEach(function (node) {
    // try {
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
    // } catch (error) {
    //   console.error(
    //     `ZJAX ERROR – Unable to parse z-swap: ${error.message}\n`,
    //     node
    //   );
    // }
  });
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

function prettyNodeName(nodeOrDocument) {
  return nodeOrDocument === document
    ? "#document"
    : "<" +
        nodeOrDocument.tagName.toLowerCase() +
        (nodeOrDocument.id ? "#" + nodeOrDocument.id : "") +
        ">";
}

function getMatchingNodes(documentOrNode, selector) {
  // Find all decendent nodes with a z-swap attribute
  const nodesToParse = [];
  nodesToParse.push(...documentOrNode.querySelectorAll(selector));
  if (documentOrNode != document && documentOrNode.matches(selector)) {
    // And include the node itself if it has a z-swap attribute
    nodesToParse.push(documentOrNode);
  }
  return nodesToParse;
}

function getSwaps(swapString) {
  // Parse a  like: "foo->#bar|inner, #baz" into an array of objects
  // [
  //   { source: "foo", target: "#bar", swapStringType: "inner" },
  //   { source: "#baz", target: "#baz", swapType: null }
  // ]
  const swaps = [];
  swapString.split(",").forEach(function (swapPart) {
    const swap = {};
    const newAndOldNodes = swapPart.split("->");
    const oldAndSwapType = newAndOldNodes.pop();
    const [oldNode, swapType] = oldAndSwapType.split("|");
    const newNode = newAndOldNodes[0] || oldNode;
    swap["new"] = newNode;
    swap["old"] = oldNode;
    swap["swapType"] = swapType || "outer";
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
    // try {
    const responseDOM = await getResponseDOM(zSwap.method, zSwap.endpoint);
    // Swap nodes
    zSwap.swaps.forEach(function (swap) {
      // Get the source and target nodes
      const [getNearestNodeNode, oldNode] = getSourceAndTargetNodes(
        responseDOM,
        swap
      );

      // Before swapping in a source node, parse it for z-swaps
      debug(`Parsing incoming response for z-swaps`);
      parseZSwaps(getNearestNodeNode);
      // Swap the node using a view transition?
      if (isVTSupported && zjax.transitions) {
        document.startViewTransition(async () => {
          swapOneNode(oldNode, getNearestNodeNode, swap.swapType);
        });
      } else {
        swapOneNode(oldNode, getNearestNodeNode, swap.swapType);
      }
    });
    // } catch (error) {
    //   console.error(
    //     `ZJAX ERROR – Unable to execute z-swap function: ${error.message}\n`,
    //     node
    //   );
    // }
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

function getSourceAndTargetNodes(responseDOM, swap) {
  // Rather than just finding the source node in the response DOM,
  // try to find it within the target node selector in the response DOM
  // or the closest ancestor node from the target node selector
  const oldSelectorInResponseDOM = responseDOM.querySelector(swap.old);
  const nearestNewNode = getNearestNode(oldSelectorInResponseDOM, swap.new);
  const newNode = nearestNewNode || responseDOM.querySelector(swap.new);
  if (!newNode && swap.swapType !== "none" && swap.swapType !== "delete") {
    throw new Error(`Source node ${swap.new} does not exist in response DOM`);
  }
  const oldNode = document.querySelector(swap.old);
  if (!oldNode && swap.swapType !== "none") {
    throw new Error(`Target node '${swap.old}' does not exist in local DOM`);
  }
  return [newNode, oldNode];
}

function getNearestNode(node, selector) {
  // Is this node itself a match?
  if (node.matches(selector)) {
    return node;
  }
  // Does this node contain a node matching the selector?
  const containedNode = node.querySelector(selector);
  if (containedNode) {
    return containedNode;
  }
  // Return the closest ancestor node that matches the selector
  const closestNode = node.closest(selector);
  if (closestNode) {
    return closestNode;
  }
  return null;
}

function swapOneNode(existingNode, newNode, swapType) {
  if (swapType === "outer") {
    existingNode.outerHTML = newNode.outerHTML;
    return;
  }
  if (swapType === "inner") {
    existingNode.innerHTML = newNode.outerHTML;
    return;
  }
  if (swapType === "before") {
    existingNode.parentNode.insertBefore(newNode, existingNode);
    return;
  }
  if (swapType === "after") {
    existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);
    return;
  }
  if (swapType === "prepend") {
    existingNode.insertBefore(newNode, existingNode.firstChild);
    return;
  }
  if (swapType === "append") {
    existingNode.appendChild(newNode);
    return;
  }
  if (swapType === "delete") {
    existingNode.remove();
    return;
  }
  if (swapType === "none") {
    return;
  }
  throw new Error(`Unknown swap type: ${swapType}`);
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
