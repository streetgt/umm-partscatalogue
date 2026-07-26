import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const sqlite = new Database(process.env.DB_PATH ?? "./data/catalogue.sqlite");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
