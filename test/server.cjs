const express = require("express");
const path = require("node:path");

const app = express();
app.use(
  express.urlencoded({
    extended: true,
  }),
);

const port = 3000;

// Serve static files from the 'test' directory
app.use(express.static(path.join(__dirname, "html")));
app.use(express.static(path.join(__dirname, "../dist")));

app.post("/submit", (req, res) => {
  console.log("req.body", req.body);
  res.send("<h2>Success</h2>");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
