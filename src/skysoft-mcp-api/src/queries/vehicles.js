const VEHICLE_BASE_QUERY = `
  SELECT
    -- Vehicle core
    v.id AS vehicle_id,
    v.vehicle_nickname,
    v.vehicle_number,
    v.vehicle_vin,
    v.vehicle_year,
    v.vehicle_comments,
    v.current_km,
    v.km_sync_status,
    v.has_wheelchair,
    v.status AS vehicle_status,
    v.asset_id,
    v.motive_vehicle_id,

    -- Vehicle type
    vt.id AS vehicle_type_id,
    vt.vehicle_type,
    vt.vehicle_desc,
    vt.fuel_km,
    vt.wear_tire_km,
    vt.cca_per_day,
    vt.insurance_per_day,
    vt.driver_wages,
    vt.operating_cost,

    -- Collection
    vc.id AS collection_id,
    vc.name AS collection_name,

    -- Sub collection
    vsc.id AS sub_collection_id,
    vsc.name AS sub_collection_name

  FROM vehicles v
  LEFT JOIN vehicletypes vt ON vt.id = v.vehicle_type
  LEFT JOIN vehicles_collections vc ON vc.id = vt.vc_id
  LEFT JOIN vehicles_sub_collections vsc ON vsc.id = vt.vsc_id
  WHERE v.status = 1
`;

export const getAllVehiclesQuery = () =>
  VEHICLE_BASE_QUERY + ` ORDER BY v.vehicle_nickname ASC`;

export const getSingleVehicleQuery = () =>
  VEHICLE_BASE_QUERY + ` AND v.id = ? LIMIT 1`;

// ── Scheduled maintenance per vehicle ──────────────────────────────
export const getVehicleMaintenanceQuery = () => `
  SELECT
    vsm.id AS maintenance_id,
    vsm.vehicle,
    vsm.effective_date,
    vsm.last_maintenance_date,
    vsm.last_replaced_km,
    vsm.status AS maintenance_status,

    -- Configuration setting
    scs.id AS setting_id,
    scs.setting_name,
    scs.setting_type,
    scs.maintenance_type,

    -- Configuration group
    sc.id AS config_id,
    sc.configuration_name

  FROM vehicle_scheduled_maintenance vsm
  LEFT JOIN scheduled_configuration_settings scs ON scs.id = vsm.scheduled_maintenance
  LEFT JOIN scheduled_configurations sc ON sc.id = vsm.scheduled_maintenance
  WHERE vsm.vehicle = ?
    AND vsm.status = 1
  ORDER BY vsm.last_maintenance_date DESC
`;

// ── Repair logs per vehicle ─────────────────────────────────────────
export const getVehicleRepairLogsQuery = () => `
  SELECT
    vrl.id AS repair_log_id,
    vrl.issue_date,
    vrl.repair_desc,
    vrl.issue_type,
    vrl.defect_source,
    vrl.defect_status,
    vrl.manager_status,
    vrl.notes,
    vrl.estimate,
    vrl.labor_cost,
    vrl.parts_cost,
    vrl.total_cost,
    vrl.mechanic,
    vrl.repair_date,
    vrl.repair_completion_date,
    vrl.is_duplicate,
    vrl.status AS log_status,

    -- Repair code category
    rcc.repair_code_category,

    -- Linked repair order
    rpo.id AS repair_order_id,
    rpo.work_order_number,
    rpo.invoice_number,
    rpo.invoice_amount,
    rpo.work_order_status,
    rpo.vehicle_status AS vehicle_shop_status,

    -- Vendor
    vd.vendor_name,
    vd.vendor_phone,
    vd.vendor_email

  FROM vehicle_repair_logs vrl
  LEFT JOIN repair_code_categories rcc ON rcc.id = vrl.repair_code_category
  LEFT JOIN repair_purchase_orders rpo ON rpo.id = vrl.linked_to_roid
  LEFT JOIN vendors vd ON vd.id = rpo.vendor
  WHERE vrl.vehicle = ?
    AND vrl.is_duplicate != 'y'
  ORDER BY vrl.issue_date DESC
`;

// ── Repair purchase orders per vehicle ─────────────────────────────
export const getVehicleRepairOrdersQuery = () => `
  SELECT
    rpo.id AS ro_id,
    rpo.work_order_number,
    rpo.invoice_number,
    rpo.invoice_amount,
    rpo.kms_before_service,
    rpo.kms_after_service,
    rpo.estimated_repair_amount,
    rpo.service_completed_date,
    rpo.payment_method,
    rpo.payment_notes,
    rpo.repair_notes,
    rpo.work_order_status,
    rpo.vehicle_status,
    rpo.total_labor_cost,
    rpo.total_parts_cost,
    rpo.total_total_cost,
    rpo.invoice_paid_status,
    rpo.status AS ro_status,

    -- Vendor
    vd.id AS vendor_id,
    vd.vendor_name,
    vd.vendor_phone,
    vd.vendor_email,

    -- Repair order line items
    rpor.id AS repair_item_id,
    rpor.item_type,
    rpor.repair_notes AS item_notes,
    rpor.rpor_status AS item_status,
    rpor.labor_cost AS item_labor_cost,
    rpor.parts_cost AS item_parts_cost,
    rpor.total_cost AS item_total_cost,
    rpor.invoice_status AS item_invoice_status,
    rpor.service_completion_date AS item_completion_date,

    -- Defect linked to item
    vrl.id AS defect_id,
    vrl.repair_desc AS defect_desc,
    vrl.issue_type AS defect_issue_type,
    vrl.defect_status

  FROM repair_purchase_orders rpo
  LEFT JOIN vendors vd ON vd.id = rpo.vendor
  LEFT JOIN repair_purchase_order_repairs rpor ON rpor.repair_purchase_order = rpo.id
  LEFT JOIN vehicle_repair_logs vrl ON vrl.id = rpor.repair_log_id
  WHERE rpo.vehicle = ?
  ORDER BY rpo.created_on DESC
`;

// ── Trip schedule per vehicle ───────────────────────────────────────
export const getVehicleTripScheduleQuery = () => `
  SELECT
    tvs.id AS schedule_id,
    tvs.trip_date,
    tvs.status AS schedule_status,
    tvs.scheduled_on,

    -- Slot
    sl.slot_name,
    sl.slot_type,

    -- Trip or segment context
    tvs.trip,
    tvs.segment

  FROM trip_vehicle_schedule tvs
  LEFT JOIN slots sl ON sl.id = tvs.booked_slot
  WHERE tvs.vehicle = ?
    AND tvs.status = 'CONFIRMED'
  ORDER BY tvs.trip_date DESC
`;