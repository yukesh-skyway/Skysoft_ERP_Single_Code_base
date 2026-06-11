# SkySoft MCP API — Endpoints

> All endpoints except `/auth/login` require a valid JWT token in the header:
> `Authorization: Bearer <token>`

---

## Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login and get JWT token |

---

## Drivers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/drivers` | All drivers with full info |
| GET | `/api/v1/drivers/:id` | Single driver by ID |

---

## Contracts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/contracts` | All contracts with segments, slots, drivers, vehicles |
| GET | `/api/v1/contracts/:id` | Single contract by ID |
| GET | `/api/v1/contracts/client/:clientId` | All contracts for a specific client |

---

## Vehicles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/vehicles` | All vehicles with type and collection info |
| GET | `/api/v1/vehicles/:id` | Single vehicle by ID |
| GET | `/api/v1/vehicles/:id/full` | Vehicle + maintenance + repair logs + repair orders + schedule |
| GET | `/api/v1/vehicles/:id/maintenance` | Scheduled maintenance for a vehicle |
| GET | `/api/v1/vehicles/:id/repair-logs` | All defects and repair logs for a vehicle |
| GET | `/api/v1/vehicles/:id/repair-orders` | All repair orders with line items for a vehicle |
| GET | `/api/v1/vehicles/:id/schedule` | Trip schedule for a vehicle |

---

## Maintenance / Fleet Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/maintenance/fleet-health` | Full fleet health — maintenance status, open defects, active ROs per vehicle |

---

## Summary

| Category | Count |
|----------|-------|
| Auth | 1 |
| Drivers | 2 |
| Contracts | 3 |
| Vehicles | 7 |
| Maintenance | 1 |
| **Total** | **14** |

---

## Base URL

```
https://dev.strategyit.ca/skysoft
```

## Quick Test (Browser Console)

```js
// Step 1 — login
const login = await fetch("https://dev.strategyit.ca/skysoft/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "your@email.com", password: "yourpassword" })
});
const { token } = await login.json();

// Step 2 — call any endpoint
const res = await fetch("https://dev.strategyit.ca/skysoft/api/v1/maintenance/fleet-health", {
  headers: { "Authorization": `Bearer ${token}` }
});
const data = await res.json();
console.log(data);
```