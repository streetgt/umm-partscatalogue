import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogueRouter } from "./routes/catalogue.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT ?? 3000;

app.use("/api", catalogueRouter);
app.use("/images", express.static(path.resolve(__dirname, "../public/images")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
