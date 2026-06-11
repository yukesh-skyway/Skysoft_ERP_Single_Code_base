import { authenticate } from "../middleware/authenticate.js";
import {
  getAllContractsQuery,
  getSingleContractQuery,
  getContractsByClientQuery
} from "../queries/contracts.js";

export default async function contractRoutes(app) {

  // GET all contracts with full details
  app.get("/", { preHandler: authenticate }, async (req, reply) => {
    const [rows] = await app.db.query(getAllContractsQuery());
    return { success: true, count: rows.length, data: rows };
  });

  // GET single contract by ID
  app.get("/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params;
    const [rows] = await app.db.query(getSingleContractQuery(), [id]);
    if (!rows.length) {
      return reply.status(404).send({ success: false, message: "Contract not found" });
    }
    return { success: true, data: rows };
  });

  // GET all contracts for a specific client
  app.get("/client/:clientId", { preHandler: authenticate }, async (req, reply) => {
    const { clientId } = req.params;
    const [rows] = await app.db.query(getContractsByClientQuery(), [clientId]);
    return { success: true, count: rows.length, data: rows };
  });
}