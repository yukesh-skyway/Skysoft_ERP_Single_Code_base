import { authenticate } from "../middleware/authenticate.js";
import { getAllDriversQuery, getSingleDriverQuery } from "../queries/drivers.js";

export default async function driverRoutes(app) {
  app.get("/", { preHandler: authenticate }, async (req, reply) => {
    const [rows] = await app.db.query(getAllDriversQuery());
    return { success: true, count: rows.length, data: rows };
  });

  app.get("/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params;
    const [rows] = await app.db.query(getSingleDriverQuery(), [id]);
    if (!rows.length) {
      return reply.status(404).send({ success: false, message: "Driver not found" });
    }
    return { success: true, data: rows[0] };
  });
}