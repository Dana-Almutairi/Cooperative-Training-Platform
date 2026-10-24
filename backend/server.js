const express = require("express");
const companiesRoutes = require("./routes/companies");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Cooperative Training Platform API",
    status: "success",
    version: "1.0.0"
  });
});

app.use("/api/companies", companiesRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});