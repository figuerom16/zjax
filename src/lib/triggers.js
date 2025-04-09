// Receives a z-swap or z-action value as a string (and also the node itelf).
// Returns an array of trigger objects like this:

// [
//   {
//     event: 'click',
//     modifiers: { shift: true },
//     target: [Object],
//     node: [Object],
//     handlerString: "GET /other-page"
//   },
//   {
//     event: 'mouseover',
//     modifiers: {},
//     target: [Object],
//     node: [Object],
//     handlerString: "GET /remote-tooltip"
//   },
// };

import { constants } from "../lib";

export function parseTriggers(valueString, node) {
  const triggers = [];

  // Needs to handle multiple statements separated by ", @".
  // ...and also multiple trigger events like "@[click,change] openModal"

  // First, split the statements by ", @"
  const statements = valueString.split(/,\s*(?=@)/);
  for (const statement of statements) {
    // Split the trigger and handler string
    const match = statement.match(/^(@\w+[\w\-\.]+|@\[[\w\-\.\,\s]+\])?(.*)/);

    // Reduce things like "@click" to "click" and "@[click.once, change]" to "click.once,change"
    const triggerString = match[1] ? match[1].replace(/[@\[\]\s]/g, "") : "";

    // Make sure handlerString is trimmed or an empty string if undefined.
    const handlerString = match[2] ? match[2].trim() : "";

    // Insert default?
    if (!triggerString) {
      const event = node.tagName === "FORM" ? "submit" : "click";
      triggers.push({
        event,
        modifiers: {},
        node,
        target: node,
        handlerString,
      });
      continue;
    }

    // Split the trigger string by commas to get an array of trigger.modifiers
    const triggerStringParts = triggerString.split(",");
    for (const part of triggerStringParts) {
      // Split the trigger.modifiers, use the first as event, then get modifiers object.
      const modifiersStrings = part.split(".");
      const event = modifiersStrings.shift();
      const modifiers = parseModifiers(event, modifiersStrings);
      const modifierKeys = Object.keys(modifiers);
      let target;
      if (modifierKeys.includes("document")) target = document;
      else if (modifierKeys.includes("window")) target = window;
      else if (modifierKeys.includes("outside")) target = window;
      else target = node;

      triggers.push({
        event,
        modifiers,
        target,
        node,
        handlerString,
      });
    }
  }
  return triggers;
}

// Private
function parseModifiers(event, modifiersStrings) {
  // We need to know if this is a keyboard or mouse event since those have special modifiers.
  const isMouseEvent = constants.mouseEvents.includes(event);
  const isKeyboardEvent = constants.keyboardEvents.includes(event);

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
  for (const part of modifiersStrings) {
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
      modifiers[part] = true;
      continue;
    }

    // For outside modifiers, we'll let zactions/zswaps handle this

    if (part === "outside" && (isMouseEvent || isKeyboardEvent)) {
      modifiers[part] = true;
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

  return modifiers;
}
