import express from "express";
import { config } from "dotenv";

import v1Router from "./core/router.ts";
import connectDB from "./core/db.ts";

config();
const app = express();
connectDB(); // to connect the db

app.use(express.json());

app.get("/", (_, res) => {
  res.status(200).json("Hello this is Streamly api");
});
app.use("/api/v1", v1Router);

app.listen(process.env.PORT, () => {
  console.log(` (-) Server is running on PORT: ${process.env.PORT}`);
});
