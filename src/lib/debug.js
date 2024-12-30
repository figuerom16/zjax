export function debug() {
  if (!(window.zjax && window.zjax.debug)) {
    return;
  }
  console.log("ZJAX DEBUG:", ...arguments);
}
