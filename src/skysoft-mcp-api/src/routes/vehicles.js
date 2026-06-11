import { authenticate } from "../middleware/authenticate.js";
import {
  getAllVehiclesQuery,
  getSingleVehicleQuery,
  getVehicleMaintenanceQuery,
  getVehicleRepairLogsQuery,
  getVehicleRepairOrdersQuery,
  getVehicleTripScheduleQuery
} from "../queries/vehicles.js";

export default async function vehicleRoutes(app) {

  // GET all vehicles
  app.get("/", { preHandler: authenticate }, async (req, reply) => {
    const [rows] = await app.db.query(getAllVehiclesQuery());
    return { success: true, count: rows.length, data: rows };
  });

  // GET single vehicle
  app.get("/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params;
    const [rows] = await app.db.query(getSingleVehicleQuery(), [id]);
    if (!rows.length) {
      return reply.status(404).send({ success: false, message: "Vehicle not found" });
    }
    return { success: true, data: rows[0] };
  });

  // GET vehicle + all related data in one call
  app.get("/:id/full", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params;

    const [
      [vehicle],
      [maintenance],
      [repairLogs],
      [repairOrders],
      [tripSchedule]
    ] = await Promise.all([
      app.db.query(getSingleVehicleQuery(), [id]),
      app.db.query(getVehicleMaintenanceQuery(), [id]),
      app.db.query(getVehicleRepairLogsQuery(), [id]),
      app.db.query(getVehicleRepairOrdersQuery(), [id]),
      app.db.query(getVehicleTripScheduleQuery(), [id])
    ]);

    if (!vehicle.length) {
      return reply.status(404).send({ success: false, message: "Vehicle not found" });
    }

    return {
      success: true,
      data: {
        ...vehicle[0],
        maintenance,
        repair_logs: repairLogs,
        repair_orders: repairOrders,
        trip_schedule: tripSchedule
      }
    };
  });

  // GET maintenance only
  app.get("/:id/maintenance", { preHandler: authenticate }, async (req, reply) => {
    const [rows] = await app.db.query(getVehicleMaintenanceQuery(), [req.params.id]);
    return { success: true, count: rows.length, data: rows };
  });

  // GET repair logs only
  app.get("/:id/repair-logs", { preHandler: authenticate }, async (req, reply) => {
    const [rows] = await app.db.query(getVehicleRepairLogsQuery(), [req.params.id]);
    return { success: true, count: rows.length, data: rows };
  });

  // GET repair orders only
  app.get("/:id/repair-orders", { preHandler: authenticate }, async (req, reply) => {
    const [rows] = await app.db.query(getVehicleRepairOrdersQuery(), [req.params.id]);
    return { success: true, count: rows.length, data: rows };
  });

  // GET trip schedule only
  app.get("/:id/schedule", { preHandler: authenticate }, async (req, reply) => {
    const [rows] = await app.db.query(getVehicleTripScheduleQuery(), [req.params.id]);
    return { success: true, count: rows.length, data: rows };
  });
}