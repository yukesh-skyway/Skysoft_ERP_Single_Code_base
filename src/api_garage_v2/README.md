# Garage Webhook API - Node.js Integration

## 📋 Overview

This folder contains the **Garage Webhook System** - a backend module that receives repair order updates from external garage management systems and syncs them to the SkySoft fleet management database.

**Converted from:** PHP Garage API  
**Integrated with:** `/api` (main Express.js backend)

---

## 🚀 **QUICK START**

**New here?** Read these first:
1. **[INDEX.md](./INDEX.md)** - 📚 Documentation index (find what you need)
2. **[SUMMARY.md](./SUMMARY.md)** - 🎯 5-minute overview
3. **[INTEGRATION.md](./INTEGRATION.md)** - ⚡ 15-minute integration guide

---

## 🏗️ Architecture

```
External Garage → Webhook Endpoints → Database → Motive API
                  (/api_garage/public/*)
```

### **Integration with Main API:**
- ✅ Routes mounted in `/api/server.js` at `/api_garage/public/*`
- ✅ Uses same database connection as main API (`/api/db/connection.js`)
- ✅ Separate authentication (Bearer tokens, not PHP session)
- ✅ Dual logging (file + database)

---

## 📂 Folder Structure

```
/api_garage/
├── /db
│   └── connection.js          ✅ References main API database
│
├── /middleware
│   └── webhookAuth.js         ✅ Bearer token authentication
│
├── /utils
│   ├── webhookLogger.js       ✅ Dual logging (file + DB)
│   ├── statusMapper.js        ✅ Status mapping (Garage ↔ SkySoft ↔ Motive)
│   └── motiveApi.js           ✅ Motive API integration (sync defects)
│
├── /controllers
│   └── webhookController.js   ✅ All webhook endpoints
│
├── /routes
│   └── webhookRoutes.js       ✅ Route definitions
│
├── .gitignore
├── STRUCTURE.md
├── MOTIVE_INTEGRATION.md      ✅ Motive API documentation
└── README.md                  ← This file
```

---

## ✅ **COMPLETED - PHASE 2 DONE!**

### **1. Database Connection** (`/db/connection.js`)
- ✅ References main API's database connection
- ✅ No duplicate connection pools

### **2. Authentication** (`/middleware/webhookAuth.js`)
- ✅ Bearer token validation
- ✅ SHA-256 token hashing (matches PHP)
- ✅ Scope enforcement (e.g., `defects:update`, `ro:update`)
- ✅ Request logging to `api_request_logs` table
- ✅ Token expiry checking

### **3. Logger** (`/utils/webhookLogger.js`)
- ✅ Dual logging (file + database)
- ✅ Daily log files: `garage_api_call_log_YYYY-MM-DD.txt`
- ✅ Raw request logging: `raw_requests_YYYY-MM-DD.json`
- ✅ Database logging to `vm_logs` table

### **4. Status Mapper** (`/utils/statusMapper.js`)
- ✅ Garage → SkySoft mapping
- ✅ SkySoft → Motive mapping
- ✅ Status validation helpers

### **5. Controller** (`/controllers/webhookController.js`)
- ✅ `list()` - List ROs with filtering/pagination
- ✅ `details()` - Get RO details with attachments, repairs, logs
- ✅ `updateVehicleDefect_v2()` - Update defect status (current version)
- ✅ `updateVehicleDefect()` - Legacy endpoint (redirects to v2)
- ✅ `updateRO()` - Update entire RO
- ✅ Helper functions:
  - `processSingleDefectV2()` - Defect update with merge group handling
  - `processSingleSM()` - Scheduled maintenance update
  - `processSingleRepairItem()` - Repair item processing
  - `checkAndUpdateRODetails()` - Auto-complete RO when all items done

### **6. Routes** (`/routes/webhookRoutes.js`)
- ✅ All endpoints defined
- ✅ Bearer token auth middleware applied
- ✅ Scope enforcement configured

---

## 🔧 **NEXT STEP: MOUNT ROUTES IN MAIN SERVER**

Add to `/api/server.js`:

```javascript
// Garage Webhook API (separate from main API)
const webhookRoutes = require('../api_garage/routes/webhookRoutes');
app.use('/api_garage/public', webhookRoutes);
```

---

## 🎯 **Available Endpoints**

| Method | Endpoint | Purpose | Scope |
|--------|----------|---------|-------|
| POST | `/api_garage/public/roDetails/list` | List repair orders | `rodetail:list` |
| GET | `/api_garage/public/roDetails/details` | Get RO details | `rodetail:read` |
| POST | `/api_garage/public/updateVehicleDefect_v2` | Update defect (v2) | `defects:update` |
| POST | `/api_garage/public/updateVehicleDefect` | Update defect (legacy) | `defects:update` |
| POST | `/api_garage/public/updateRO` | Update entire RO | `ro:update` |

---

## 🔐 **Authentication Flow**

```
1. External garage sends request with Bearer token
   Authorization: Bearer abc123xyz...

2. webhookAuth middleware validates:
   - Token exists
   - Token not expired
   - Token not revoked
   - Token has required scope
   - Logs to api_request_logs

3. Request continues to controller
   - req.apiToken contains user info
   - Business logic executes
   - Logs to vm_logs + file

4. Response sent back to garage
```

---

## 📊 **Status Mapping**

### **Garage → SkySoft:**
- `Open` → `In_Progress`
- `Scheduled` → `In_Progress`
- `In_Progress` → `Repair_Started`
- `Cancelled` → `Ro_Cancelled`
- `Approved` → `Completed` (Manager: Pending_Review)
- `Completed` → `Completed` (Manager: Approved)
- `Paused` → `Paused` (Manager: On_Hold)
- `Rejected` → `Rejected`
- `Repair_Not_Required` → `Repair_Not_Required` (Manager: Approved)

### **SkySoft → Motive:**
- `In_Progress` → `in_progress`
- `Repair_Started` → `in_progress`
- `Completed` → `resolved`
- `Ro_Cancelled` → `cancelled`

---

## 🔧 **Configuration**

Add to `/api/.env`:

```env
# Webhook Logging
WEBHOOK_LOG_DIR=./logs/webhooks
WEBHOOK_LOG_RAW_REQUESTS=true

# Base URL for attachments
BASE_URL=https://yourdomain.com

# Motive API (optional)
MOTIVE_API_ENABLED=true
MOTIVE_API_URL=https://api.gomotive.com
MOTIVE_API_KEY=your_key_here
```

---

## 📝 **Database Tables Used**

### **Authentication:**
- `api_tokens` - Bearer token storage
- `api_request_logs` - Request logging

### **Logging:**
- `vm_logs` - Activity logging

### **Data:**
- `repair_purchase_orders` - RO data
- `repair_purchase_order_repairs` - Defect/repair items
- `vehicle_repair_logs` - Defect history
- `vehicle_scheduled_maintenance` - SM data
- `ro_attachments` - Invoice/document attachments

---

## 🧪 **Testing Examples**

### **1. List ROs**
```bash
curl -X POST "https://yourdomain.com/api_garage/public/roDetails/list" \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "pageno": 1,
    "per_page": 20,
    "status": "Open",
    "vehicle": "123"
  }'
```

### **2. Get RO Details**
```bash
curl -X GET "https://yourdomain.com/api_garage/public/roDetails/details?roid=1960" \
  -H "Authorization: Bearer your-token-here"
```

### **3. Update Defect**
```bash
curl -X POST "https://yourdomain.com/api_garage/public/updateVehicleDefect_v2" \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "roid": 2028,
    "defectid": 6446,
    "work_order_number": "WO-2025-104",
    "work_order_status": "Completed",
    "defects_details": {
      "defect_id": 6446,
      "external_ro_id": 2028,
      "status": "Completed",
      "labor_cost": 160,
      "parts_cost": 936,
      "total_cost": 1096
    }
  }'
```

### **4. Update RO**
```bash
curl -X POST "https://yourdomain.com/api_garage/public/updateRO" \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "external_ro_id": 1960,
    "work_order_number": "WO-2025-104",
    "work_order_status": "Completed",
    "invoice_number": "INV-123",
    "invoice_amount": 1500.00,
    "current_kms": 45000,
    "service_completion_date": "2025-01-15T14:30:00Z"
  }'
```

---

## 🔄 **Key Features**

### **Merge Group Handling**
- Defects can be merged/grouped together
- Updates to one defect update all defects in the group
- Tracked via `vehicle_repair_logs.merged_records_id`

### **Scheduled Maintenance**
- Separate handling for SM vs regular defects
- Updates `vehicle_scheduled_maintenance` table on completion
- Tracks last maintenance date and odometer

### **Auto-Complete RO**
- Automatically marks RO as "Completed" when all defects/SMs are done
- Checked after each defect/SM update

### **Dual Logging**
- File logging: Daily text files + JSON request logs
- Database logging: `vm_logs` + `api_request_logs` tables

---

**Status:** ✅ **PHASE 2 COMPLETE - READY FOR INTEGRATION!**  
**Next:** Mount routes in `/api/server.js`