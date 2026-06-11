import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import formbody from "@fastify/formbody";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import authRoutes from "./routes/auth.js";
import { authenticate } from "./middleware/authenticate.js"; // 👈 add this import
import driverRoutes from "./routes/drivers.js";
import contractRoutes from "./routes/contracts.js"; 
import vehicleRoutes from "./routes/vehicles.js";
import maintenanceRoutes from "./routes/maintenance.js";
dotenv.config();

const app = Fastify({ logger: true });

const start = async () => {
  await app.register(cors);
  await app.register(formbody);
  await app.register(jwt, { secret: process.env.JWT_SECRET });

  app.db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  app.get("/", async () => ({
    success: true,
    message: "SkySoft MCP API Running 🚀"
  }));

  await app.register(authRoutes, { prefix: "/api/v1/auth" });
await app.register(driverRoutes, { prefix: "/api/v1/drivers" });
await app.register(contractRoutes, { prefix: "/api/v1/contracts" }); 
await app.register(vehicleRoutes, { prefix: "/api/v1/vehicles" });
await app.register(maintenanceRoutes, { prefix: "/api/v1/maintenance" });
  // Protected route 👇
  app.get("/api/v1/protected", { preHandler: authenticate }, async (request, reply) => {
    return { success: true, user: request.user };
  });

  await app.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
};

start();