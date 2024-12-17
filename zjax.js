// Create a global zjax object for setting debug mode and registering JS actions.
window.zjax = getGlobalZjaxObject();

// Parse the DOM on load.
addEventListener("DOMContentLoaded", function () {
  parseZSwaps();
});

function getGlobalZjaxObject() {
  return {
    debug: false,
    actions: {},
    register: function (arg1, arg2) {
      // Usage:
      // zjax.register({
      //   openPanel($) {
      //     console.log('openPanel called by element', $.el);
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

function parseZSwaps() {
  document.querySelectorAll("[z-swap]").forEach(function (el) {
    try {
      const valueString = collapseCommas(el.getAttribute("z-swap"));
      const valueParts = valueString.split(/\s/);
      if (valueParts.length < 1 || valueParts.length > 4) {
        throw new Error("Must have between 1 and 4 parts separated by spaces.");
      }
      // First pop off the last array item which should be the swap specifier
      const swapString = valueParts.pop() || null;
      // Next pop off the first array item only if it's a valid trigger specifier
      const triggerString =
        valueParts[0] && valueParts[0].startsWith("@")
          ? valueParts.shift()
          : null;
      // With max two items left, the last one should be the endpoint
      const endpointString = valueParts.pop() || null;
      // And if anything is left, it should be the method
      const methodString = valueParts.pop() || null;
      // Now we can get the trigger, method, endpoint, and swaps
      const zSwap = {
        trigger: getTrigger(triggerString, el),
        method: getMethod(methodString, el),
        endpoint: getEndpoint(endpointString, el),
        swaps: getSwaps(swapString),
      };
      // Add the swap function listener to the element
      const zSwapFunction = getZSwapFunction(zSwap, el);
      attachEventListener(zSwap.trigger, zSwapFunction, el);
      attachMutationObserver(zSwap.trigger, zSwapFunction, el);
    } catch (error) {
      console.error(
        `ZJAX ERROR – Unable to parse z-swap: ${error.message}\n`,
        el
      );
    }
  });
}

// Helper functions

function getTrigger(triggerString, el) {
  if (triggerString) {
    return triggerString.substr(1);
  }
  if (el.tagName === "FORM") {
    return "submit";
  }
  return "click";
}

function getMethod(methodString, el) {
  if (methodString) {
    const method = methodString.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      throw new Error(`Invalid method: ${method}`);
    }
    return method;
  }
  if (el.tagName === "FORM") {
    return el.getAttribute("method") || "POST";
  }
  return "GET";
}

function getEndpoint(endpointString, el) {
  // If we're seeing a method here, that means the endpoint is missing.
  if (["GET", "POST", "PUT", "PATCH", "DELETE"].includes(endpointString)) {
    throw new Error("Missing required endpoint value.");
  }
  if (endpointString) {
    return endpointString;
  }
  if (el.tagName === "A") {
    return el.getAttribute("href");
  }
  if (el.tagName === "FORM") {
    return el.getAttribute("action");
  }
  throw new Error("Missing required endpoint value.");
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
    if (zjax.debug) {
      console.log("zjax", zSwap, el);
    }
    // Call the action
    try {
      // Get formData?
      // let formData
      const response = await fetch(zSwap.endpoint, {
        method: zSwap.method,
        body: null,
      });
      if (!response.ok) {
        // Replace the entire HTML and follow redirects
        return;
      }
      const responseDOM = new DOMParser().parseFromString(
        await response.text(),
        "text/html"
      );
      // Swap elements
      zSwap.swaps.forEach(function (swap) {
        const newNode = responseDOM.querySelector(swap.source);
        if (!newNode) {
          throw new Error(
            `Source element ${swap.source} does not exist in response DOM`
          );
        }
        const existingNode = document.querySelector(swap.target);
        if (!existingNode) {
          throw new Error(
            `Target element '${swap.target}' does not exist in local DOM`
          );
        }
        swapOneElement(existingNode, newNode, swap.swapType);
      });
    } catch (error) {
      console.error(
        `ZJAX ERROR – Unable to execute z-swap function: ${error.message}\n`,
        el
      );
    }
  };
}

function swapOneElement(existingNode, newNode, swapType) {
  existingNode.style.viewTransitionName = "zjax-transition";
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
          console.log("Event listener removed because node is detached.");
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
