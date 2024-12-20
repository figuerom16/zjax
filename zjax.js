// Create a global zjax object for setting debug mode and registering JS actions.
window.zjax = getGlobalZjaxObject();
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Parse the DOM on load.
addEventListener("DOMContentLoaded", function () {
  zjax.debug && debug("Parsing DOM");
  parseZSwaps(document);
});

function getGlobalZjaxObject() {
  return {
    debug: false,
    actions: {},
    register: function (arg1, arg2) {
      // Usage:
      // zjax.register({
      //   openPanel($) {
      //     console.log('openPanel called by node', $.el);
      //   }
      // })
      // An optional namespace can be specified as arg1 so that actions
      // can be called like z-action="books.closePanel"
      const namespace = arg2 ? arg1 : null;
      const object = arg2 ? arg2 : arg1;
      let actionsTarget;
      if (namespace) {
        this.actions[namespace] = {};
        actionsTarget = this.actions[namespace];
      } else {
        actionsTarget = this.actions;
      }
      Object.keys(object).forEach(function (name) {
        const handler = object[name];
        actionsTarget[name] = handler;
      });
    },
  };
}

function parseZSwaps(documentOrNode) {
  const zSwapNodes = getMatchingNodes(documentOrNode, "[z-swap]");
  zjax.debug &&
    debug(
      `Found ${zSwapNodes.length} z-swap nodes in ${prettyNodeName(
        documentOrNode
      )}`
    );
  zSwapNodes.forEach(function (el) {
    try {
      // Collapse commas
      const valueString = collapseCommas(el.getAttribute("z-swap"));
      // Split on whitespace
      const valueParts = valueString.split(/\s/);
      if (valueParts.length < 1 || valueParts.length > 4) {
        throw new Error("Must have between 1 and 4 parts separated by spaces.");
      }

      // Loop through space-separated parts of the z-swap attribute to build the zSwap object
      const zSwap = {};
      const leftoverParts = [];

      while (valueParts.length > 0) {
        const part = valueParts.shift();
        const typeAndValue = getTriggerMethodOrEndpointPair(part);
        if (typeAndValue) {
          zSwap[typeAndValue[0]] = typeAndValue[1];
        } else {
          leftoverParts.push(part);
        }
      }

      // Now set defaults for missing values.
      if (!zSwap.trigger) {
        zSwap.trigger = el.tagName === "FORM" ? "submit" : "click";
      }
      if (!zSwap.method) {
        zSwap.method = el.tageName === "FORM" ? "POST" : "GET";
      }
      if (!zSwap.endpoint) {
        if (el.tagName === "FORM") {
          zSwap.endpoint = el.action;
        } else if (el.tagName === "A") {
          zSwap.endpoint = el.href;
        }
      }

      // Finally, add the array of swaps
      zSwap.swaps = getSwaps(leftoverParts.join(" "));

      // Add the swap function listener to the node
      const zSwapFunction = getZSwapFunction(zSwap, el);
      attachEventListener(zSwap.trigger, zSwapFunction, el);
      attachMutationObserver(zSwap.trigger, zSwapFunction, el);
      zjax.debug &&
        debug(
          `Added z-swap for '${zSwap.trigger}' events to ${prettyNodeName(el)}`
        );
    } catch (error) {
      console.error(
        `ZJAX ERROR – Unable to parse z-swap: ${error.message}\n`,
        el
      );
    }
  });
}

function getTriggerMethodOrEndpointPair(swapSpecifier) {
  // Is this a Trigger?
  if (swapSpecifier.startsWith("@")) {
    return ["trigger", swapSpecifier.substr(1)];
  }
  // Is this an HTTP Method?
  if (METHODS.includes(swapSpecifier.toUpperCase())) {
    return ["method", swapSpecifier.toUpperCase()];
  }
  // Is this an Endpoint?
  regexEndpoint = /^(\/.*|\.\/.*|https?:\/\/.*|\.)$/;
  if (regexEndpoint.test(swapSpecifier)) {
    return ["endpoint", swapSpecifier];
  }
}
// Helper functions

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
    const sourceAndTarget = swapPart.split("->");
    const targetAndSwapType = sourceAndTarget.pop();
    const [target, swapType] = targetAndSwapType.split("|");
    const source = sourceAndTarget[0] || target;
    swap["source"] = source;
    swap["target"] = target;
    swap["swapType"] = swapType || "outer";
    swaps.push(swap);
  });
  return swaps;
}

function getZSwapFunction(zSwap, el) {
  return async function (event) {
    event.preventDefault();
    event.stopPropagation();
    zjax.debug && debug("z-swap triggered for", zSwap);
    // Call the action
    try {
      // Get formData?
      // const body = ?? # TODO
      const response = await fetch(zSwap.endpoint, {
        method: zSwap.method,
        body: null,
      });
      if (!response.ok) {
        // TODO: Replace the entire HTML and follow redirects
        return;
      }
      const responseDOM = new DOMParser().parseFromString(
        await response.text(),
        "text/html"
      );
      zjax.debug &&
        debug(`z-swap response from ${zSwap.endpoint} received and parsed`);
      // Swap nodes
      zSwap.swaps.forEach(function (swap) {
        const newNode = responseDOM.querySelector(swap.source);
        if (
          !newNode &&
          swap.swapType !== "none" &&
          swap.swapType !== "delete"
        ) {
          throw new Error(
            `Source node ${swap.source} does not exist in response DOM`
          );
        }
        const existingNode = document.querySelector(swap.target);
        if (!existingNode && swap.swapType !== "none") {
          throw new Error(
            `Target node '${swap.target}' does not exist in local DOM`
          );
        }
        // Before swapping in a new node, parse it for z-swaps
        zjax.debug && debug(`Parsing incoming response for z-swaps`);
        parseZSwaps(newNode);
        swapOneNode(existingNode, newNode, swap.swapType);
      });
    } catch (error) {
      console.error(
        `ZJAX ERROR – Unable to execute z-swap function: ${error.message}\n`,
        el
      );
    }
  };
}

function swapOneNode(existingNode, newNode, swapType) {
  document.startViewTransition(async () => {
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
  });
}

function attachEventListener(trigger, handler, el) {
  el.addEventListener(trigger, handler);
}

function attachMutationObserver(trigger, handler, el) {
  // Create a MutationObserver to watch for node removal
  // When the node is removed, remove the event listener
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      for (const removedNode of mutation.removedNodes) {
        if (removedNode === el || removedNode.contains(el)) {
          // Remove event listener when the el is removed from DOM
          el.removeEventListener(trigger, handler);
          zjax.debug &&
            debug(
              `Removing event listener for ${prettyNodeName(
                el
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
  console.log("ZJAX DEBUG:", ...arguments);
}
