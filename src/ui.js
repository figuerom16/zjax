document.addEventListener("DOMContentLoaded", () => {
  zjax.debug = true;

  zjax.actions = {
    alert() {
      alert("You clicked the b key.");
    },
    gotoFacebook($) {
      $.redirect("https://facebook.com");
    },
  };
});
