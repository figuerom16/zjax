export function getDollar(node, event, response = null) {
  const $ = new Proxy(function () {}, {
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
      // Handle $.event
      if (prop === "event") {
        return target.event;
      }
      // Handle $.all
      if (prop === "all") {
        return function (selector) {
          return document.querySelectorAll(selector);
        };
      }
      // Handle $.redirect
      if (prop === "redirect") {
        return function (url) {
          window.location = url;
          return;
        };
      }
      // Handle $.response (for swap error handler only)
      if (prop === "response") {
        return response;
      }
    },
  });
  $.event = event;
  return $;
}
