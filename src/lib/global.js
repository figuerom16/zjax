export function getGlobalZjax() {
  return {
    debug: false,
    transitions: true,
    zjaxActions: {}, // Defaults that take args? like zjax.remove('#foo')
    userActions: {},
    actions: function (arg1, arg2) {
      // Usage:
      // zjax.actions({
      //   openPanel($) {
      //     console.log('openPanel called by node', $.node);
      //   }
      // })
      // An optional namespace can be specified as arg1 so that userActions
      // can be called like z-action="books.closePanel"
      const namespace = arg2 ? arg1 : null;
      if (namespace === "zjax") {
        throw new Error("'zjax' is a reserved actions namespace");
      }
      const object = arg2 ? arg2 : arg1;
      let userActionsTarget;
      if (namespace) {
        this.userActions[namespace] = {};
        userActionsTarget = this.userActions[namespace];
      } else {
        userActionsTarget = this.userActions;
      }

      const objectKeys = Object.keys(object);
      for (const name in objectKeys) {
        const actionFunction = object[name];
        userActionsTarget[name] = actionFunction;
      }
    },
  };
}
