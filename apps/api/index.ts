import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "dotenv";

import v1Router from "./core/router.ts";
import connectDB from "./core/db.ts";

config();
const app = express();

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (_, res) => {
  res.status(200).json("Hello this is Streamly api");
});
app.use("/api/v1", v1Router);

app.listen(process.env.PORT, () => {
  console.log(` (-) Server is running on PORT: ${process.env.PORT}`);
});
