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
export const attrsToNotFreeze = [
  "id",
  "z-swap",
  "z-action",
  "z-confirm",
  "z-active",
  "z-validate",
];
