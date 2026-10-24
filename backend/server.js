const express = require("express");

const app = express();

const PORT = 5000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Cooperative Training Platform API",
    status: "success",
    version: "1.0.0"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});