// Constants
export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const responseTypes = ["outer", "inner"];
export const swapTypes = [
  "outer",
  "inner",
  "before",
  "after",
  "prepend",
  "append",
  "none",
  "delete",
];
export const isVTSupported = document.startViewTransition !== undefined;
export const attrsToNotFreeze = ["id", "z-swap", "z-action", "z-confirm", "z-active", "z-validate"];

export const globalTriggerModifiers = ["document", "window", "once", "prevent", "stop"];

export const timerTriggerModifiers = ["delay", "debounce", "throttle"];

export const mouseEvents = [
  "click",
  "auxclick",
  "dblclick",
  "mousedown",
  "mouseup",
  "mouseover",
  "mousemove",
  "mouseout",
  "mouseenter",
  "mouseleave",
  "context",
];

export const mouseTriggerModifiers = ["outside", "ctrl", "shift", "alt", "cmd", "meta"];

export const keyboardEvents = ["keydown", "keyup", "keypress", "input", "change", "focus", "blur"];

export const keyboardTriggerModifiers = ["keyName", "shift", "alt", "ctrl", "meta", "cmd"];
