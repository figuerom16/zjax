import { debug, utils } from "../lib.js";

export function parseZActions(documentOrNode) {
  const zActionNodes = utils.getMatchingNodes(documentOrNode, "[z-action]");
  debug(`Found ${zActionNodes.length} z-action nodes in ${utils.prettyNodeName(documentOrNode)}`);

  for (const node of zActionNodes) {
    try {
      const zActionString = node.getAttribute("z-action");
      // First get an array of objects like:
      // [
      //   {
      //     trigger, 'click',
      //     handlerString, 'the action text value'
      //   }
      // ]
      const statements = utils.getStatements(zActionString, node.tagName);
      for (const { trigger, modifiers, handlerString } of statements) {
        // Get the trigger and handler string
        // Get the action function
        const handlerFunction = getHandlerFunction(handlerString, node);
        // Add the action function listener to the node
        const $ = get$(node);
        node.addEventListener(trigger, async function (event) {
          event.preventDefault();
          event.stopPropagation();
          try {
            $.event = event;
            const result = await handlerFunction($);
            const actionEvent = new CustomEvent("action", {
              detail: {
                result: result,
                event: event,
              },
            });
            if (result) {
              node.dispatchEvent(actionEvent);
            }
          } catch (error) {
            console.error(
              `ZJAX ERROR – Unable to execute z-action: ${error.message}\n`,
              node,
              error.stack,
            );
          }
        });
        // Add a mutation observer to remove the event listener when the node is removed
        utils.attachMutationObserver(trigger, handlerFunction, node);
        if (trigger === "load") {
          node.dispatchEvent(new Event("load"));
        }

        debug(`Added z-action for '${trigger}' events to ${utils.prettyNodeName(node)}`);
      }
    } catch (error) {
      console.error(`ZJAX ERROR – Unable to parse z-action: ${error.message}\n`, node, error.stack);
    }
  }
}

function get$(node) {
  return new Proxy(function () {}, {
    apply(_target, thisArg, args) {
      // This is where the function is called like $('nav > a.active')
      if (args.length === 0) {
        return node;
      }
      if (args.length === 1) {
        const node = document.querySelector(args[0]);
        if (!node) {
          throw new Error(`$('${args[0]}') did not match any elements in the DOM.`);
        }
        return node;
      }
      throw new Error("$() can be called with a maximum of one argument.");
    },
    get(target, prop) {
      if (prop === "event") {
        return target.event;
      }
      if (prop === "all") {
        return function (selector) {
          return document.querySelectorAll(selector);
        };
      }
    },
  });
}

function getHandlerFunction(functionText, node) {
  // Does the function text look like a function name possibly namespaced?
  const actionNameMatch = functionText.match(/^(?:(\w+)\.)?(\w+)$/);

  // If so, try to find the action function on the zjax.userActions object.
  if (actionNameMatch) {
    const nameSpace = actionNameMatch[1];
    const actionName = actionNameMatch[2];
    const actions = zjax && zjax.userActions;
    // Try to find the action function with namespace.
    if (nameSpace) {
      if (!(actions[nameSpace] && actions[nameSpace][actionName])) {
        throw new Error(`Unknown action: ${nameSpace}.${actionName}`);
      }
      // Note that the handler needs to be `bind`ed to the namespace object
      // in order to preserve the `this` context within action functions.
      return actions[nameSpace][actionName].bind(actions[nameSpace]);
    } else {
      // Try to find the action function without namespace.
      if (!actions[actionName]) {
        throw new Error(`Unknown action: ${actionName}`);
      }
      return actions[actionName].bind(actions);
    }
  }

  // If no action name was found, try a custom Function for the string.
  try {
    return new Function("$", functionText);
  } catch (error) {
    throw new Error(`z-action value is invalid: ${error.message}`);
  }
}
