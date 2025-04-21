import { debug, utils, parseTriggers, addZjaxListener } from "../lib";

export function parseActions(documentOrNode) {
  // Find all nodes with z-action attributes.
  const zActionNodes = utils.getMatchingNodes(documentOrNode, "[z-action]");
  debug(`Found ${zActionNodes.length} z-action nodes in ${utils.prettyNodeName(documentOrNode)}`);

  // For each node, get an array of trigger objects
  for (const node of zActionNodes) {
    try {
      const value = node.getAttribute("z-action");
      const triggers = parseTriggers(value, node);
      // For each trigger, get the handler function and add the listener
      for (const trigger of triggers) {
        // const handlerFunction = getActionFunction(trigger);
        // node.handlerId = addZjaxListener(trigger, handlerFunction, true);

        const wrapperFunction = getWrapperFunction(trigger);
        node.handlerId = addZjaxListener(trigger, wrapperFunction, true);

        debug(`Added z-action for '${trigger.event}' events to ${utils.prettyNodeName(node)}`);
      }
    } catch (error) {
      console.error(`ZJAX ERROR – Unable to parse z-action: ${error.message}\n`, node, error.stack);
    }
  }
}

function getWrapperFunction(trigger) {
  // In order to avoid race conditions, we need to look for declared actions at runtime. So rather
  // than trying to find the action handlerFunction and attaching that to the listener, we'll
  // instead attach a function to go find and build that function from the trigger object at
  // runtime. So when the button is "clicked" for example, at _that_ time, we'll find or create
  // the handler function.

  return async function (event) {
    const handlerFunction = getActionFunction(trigger);
    await handlerFunction(event);
  };
}

function getActionFunction({ handlerString }) {
  const expectNamedActionFunction = handlerString.match(/^(\w+)((\.\w+)*)$/);

  // Later, we can use regex below to add support for args like foo.bar(a,b,c)
  // const expectNamedActionFunction = handlerString.match(/^(\w+)((\.\w+)*)(\([\w,\.\s]*\))?$/);

  if (expectNamedActionFunction) {
    const namedActionFunction = getNamedActionFunction(handlerString);
    if (!namedActionFunction) {
      throw new Error(`Unable to find z-action function: zjax.actions.${handlerString}`);
    }
    return namedActionFunction;
  }

  // If no action name was found, try a custom Function for the string.
  try {
    return new Function("$", handlerString);
  } catch (error) {
    throw new Error(`z-action value is invalid: ${error.message}`);
  }
}

function getNamedActionFunction(handlerString) {
  let path = zjax.actions;
  const parts = handlerString.split(".");
  const nestedNameSpaces = parts.slice(0, -1);
  const actionFunction = parts[parts.length - 1];
  for (const namespace of nestedNameSpaces) {
    if (!path[namespace]) {
      return undefined;
    }
    path = path[namespace];
  }
  // Preserve the `this` context within action functions by binding the path
  return path[actionFunction] ? path[actionFunction].bind(path) : undefined;
}
