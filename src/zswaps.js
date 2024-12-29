import * as constants from "./constants.js";
import { zjax } from "./zjax.js";
import { debug } from "./debug.js";

export async function parseZSwaps(documentOrNode) {
  const zSwapNodes = getMatchingNodes(documentOrNode, "[z-swap]");
  debug(
    `Found ${zSwapNodes.length} z-swap nodes in ${prettyNodeName(
      documentOrNode
    )}`
  );

  for (const node of zSwapNodes) {
    try {
      // Get the z-swap attribute and parse value into zSwapObject
      const zSwapString = node.getAttribute("z-swap");
      const zSwapObject = getZSwapObject(zSwapString, node);
      // Add the swap function listener to the node
      const zSwapFunction = getZSwapFunction(zSwapObject, node);
      attachEventListener(zSwapObject.trigger, zSwapFunction, node);
      // Add a mutation observer to remove the event listener when the node is removed
      attachMutationObserver(zSwapObject.trigger, zSwapFunction, node);
      if (zSwapObject.trigger === "load") {
        node.dispatchEvent(new Event("load"));
      }

      debug(
        `Added z-swap for '${zSwapObject.trigger}' events to ${prettyNodeName(
          node
        )}`
      );
    } catch (error) {
      console.error(
        `ZJAX ERROR – Unable to parse z-swap: ${error.message}\n`,
        node,
        error.stack
      );
    }
  }
}

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

  // Special case: @submit trigger is only available on <FORM> elements
  if (zSwapObject.trigger === "@submit" && node.tagName !== "FORM") {
    throw new Error("@submit trigger is only available on <FORM> elements");
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
      throw new Error("No endpoint inferrable or specified");
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
  if (constants.httpMethods.includes(swapSpecifier.toUpperCase())) {
    return ["method", swapSpecifier.toUpperCase()];
  }
  // Is this an Endpoint?
  //...is a ".", or starts with "/", "./", "http://", or "https://"
  const regexEndpoint = /^(\/.*|\.\/.*|https?:\/\/.*|\.)$/;
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

function getSwaps(zSwapString) {
  // Parse a  like: "foo|inner->#bar|inner, #baz" into an array of objects
  // [
  //   { response: "foo", target: "#bar", responseType: "inner", swapType: "inner" },
  //   { response: "#baz", target: "#baz", responseType: "outer", swapType: "outer" }
  // ]
  const swaps = [];
  zSwapString.split(",").forEach(function (zSwapPart) {
    const swap = {};
    const responseAndTargetSwaps = zSwapPart.split("->") || [];
    const targetNodeAndSwapType = responseAndTargetSwaps.pop();
    const [targetNode, swapType] = targetNodeAndSwapType.split("|");
    const responseNodeAndResponseType = responseAndTargetSwaps[0] || "";
    const [responseNode, responseType] =
      responseNodeAndResponseType && responseNodeAndResponseType.split("|");
    swap["response"] = responseNode || targetNode;
    swap["target"] = targetNode;
    swap["responseType"] = (responseType && responseType.trim()) || "outer";
    swap["swapType"] = (swapType && swapType.trim()) || "outer";
    // Only allow valid Response Types
    if (
      swap["responseType"] &&
      !constants.responseTypes.includes(swap["responseType"])
    ) {
      throw new Error(`Invalid swap type: ${swap["responseType"]}`);
    }
    // Only allow valid Swap Types
    if (swap["swapType"] && !constants.swapTypes.includes(swap["swapType"])) {
      throw new Error(`Invalid swap type: ${swap["swapType"]}`);
    }
    // Special case: Disallow wild cards with swap/response types
    if (swap["response"] === "*" && swap["responseType"] !== "outer") {
      throw new Error('Wild card "*" can notbe piped to a Response Type');
    }
    if (swap["target"] === "*" && swap["swapType"] !== "outer") {
      throw new Error('Wild card "*" can not be piped to a Swap Type');
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
        const [responseNode, targetNode] = getResponseAndTargetNodes(
          responseDOM,
          swap
        );
        // Before swapping in a response node, parse it for z-swaps
        debug(`Parsing incoming response for z-swaps`);
        if (responseNode) {
          // Tricky! You might have a z-swap="#not-in-response|delete"
          // so then there's nothing to parse in the response.
          parseZSwaps(responseNode);
        }
        // Swap the node using a view transition?
        if (constants.isVTSupported && zjax.transitions) {
          document.startViewTransition(() => {
            swapOneNode(
              targetNode,
              responseNode,
              swap.swapType,
              swap.responseType
            );
          });
        } else {
          swapOneNode(
            targetNode,
            responseNode,
            swap.swapType,
            swap.responseType
          );
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

function getResponseAndTargetNodes(responseDOM, swap) {
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

function getMutatedResponseNodeAndAttributesToUpdateMap(
  targetNode,
  responseNode
) {
  // Return the mutated responseNode and an attributesToUpdate object for later use.
  // The mutated responseNode retains most attributes from the targetNode for any
  // nodes with an id matching both target and response.
  const attributesToUpdateMap = {};

  // First, check the parent node for an id present in both the target and
  // response.
  const targetNodesWithIds = querySelectorAllIncludingParent(
    targetNode,
    `[id]`
  );

  for (const targetNodeWithId of targetNodesWithIds) {
    const responseNodeWithMatchingId = querySelectorIncludingParent(
      responseNode,
      `[id="${targetNodeWithId.id}"]`
    );
    if (responseNodeWithMatchingId) {
      const attributesToRetain = getAttributes(targetNodeWithId);
      const attributesToUpdate = getAttributes(responseNode);
      removeAttributes(responseNode);
      setAttributes(responseNode, attributesToRetain);
      attributesToUpdateMap[targetNodeWithId.id] = attributesToUpdate;
    }
  }

  return [responseNode, attributesToUpdateMap];
}

function swapOneNode(targetNode, responseNode, swapType, responseType) {
  // If responseType is "inner", get the childNodes
  responseNode =
    responseType === "inner" ? responseNode.childNodes : responseNode;

  // Get the mutated responseNode and attributesToUpdateMap for later use.
  let attributesToUpdateMap;
  [responseNode, attributesToUpdateMap] =
    getMutatedResponseNodeAndAttributesToUpdateMap(targetNode, responseNode);

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
    updateAttributes(responseNode, attributesToUpdateMap);
    return;
  }

  // Inner
  if (swapType === "inner") {
    targetNode.textContent = "";
    responseNodes.forEach((item) => {
      targetNode.appendChild(item);
    });
    updateAttributes(responseNode, attributesToUpdateMap);
    return;
  }

  // Before
  if (swapType === "before") {
    responseNodes.forEach((item) => {
      targetNode.parentNode.insertBefore(item, targetNode);
    });
    updateAttributes(responseNode, attributesToUpdateMap);
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
    updateAttributes(responseNode, attributesToUpdateMap);
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
    updateAttributes(responseNode, attributesToUpdateMap);
    return;
  }

  // Append
  if (swapType === "append") {
    responseNodes.forEach((item) => {
      targetNode.appendChild(item);
    });
    updateAttributes(responseNode, attributesToUpdateMap);
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

function querySelectorIncludingParent(node, selector) {
  if (node.matches(selector)) {
    return node;
  }

  return node.querySelector(selector);
}

function querySelectorAllIncludingParent(node, selector) {
  const matches = [];

  if (node.matches(selector)) {
    matches.push(node);
  }

  matches.push(...node.querySelectorAll(selector));
  return matches;
}

function getAttributes(node) {
  const attributes = [];
  for (const attribute of Array.from(node.attributes).filter(
    (attr) => !constants.attrsToNotFreeze.includes(attr.name)
  )) {
    attributes.push([attribute.name, attribute.value]);
  }
  return attributes;
}

function setAttributes(node, attributes) {
  for (const [name, value] of attributes) {
    node.setAttribute(name, value);
  }
}

function removeAttributes(node) {
  // Iterate through all attributes of the node
  Array.from(node.attributes).forEach((attr) => {
    // If the attribute is not in the allowed list, remove it
    if (!constants.attrsToNotFreeze.includes(attr.name)) {
      node.removeAttribute(attr.name);
    }
  });
}

function updateAttributes(outerNode, attributesToUpdateMap) {
  setTimeout(() => {
    for (const [id, attributes] of Object.entries(attributesToUpdateMap)) {
      const nodeWithId = querySelectorIncludingParent(
        outerNode,
        `[id="${id}"]`
      );
      if (nodeWithId) {
        removeAttributes(nodeWithId);
        setAttributes(nodeWithId, attributes);
      }
    }
  }, 20);
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
