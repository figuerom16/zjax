const express = require("express");
const path = require("node:path");

const app = express().use(express.urlencoded({ extended: true }));

// Serve static files from the 'test' directory
app.use(express.static(path.join(__dirname, "html")));
app.use(express.static(path.join(__dirname, "../dist")));

app.post("/submit", (req, res) => {
  console.log("req.body", req.body);
  res.send("<h1>Success</h1>");
});

app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
