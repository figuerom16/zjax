export function handleSwapError($, trigger) {
  // Is there a z-action @error handler on this node for this response code?
  // TODO: (this will need to use the trigger object)

  // Is there a global handler defined for this status code?
  const response = $.response || {};
  if (zjax.errors[response.status]) {
    zjax.errors[response.status]($);
    return;
  }

  // Or is there a `catchAll()` function?
  if (zjax.errors.catchAll) {
    zjax.errors.catchAll($);
    return;
  }

  // If no element level handler and no global handler, just throw an error.
  throw new Error(`${response.status} ${response.statusText} for ${endpoint}`);
}
