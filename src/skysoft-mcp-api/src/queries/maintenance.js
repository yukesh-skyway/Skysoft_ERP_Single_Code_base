export const getMaintenanceRawQuery = () => `
  SELECT
    v.id AS vehicle_id,
    v.vehicle_nickname,
    v.vehicle_number,
    v.vehicle_type,
    v.current_km,
    v.vehicle_configuration,
    scs.id AS scheduled_maintenance_id,
    scs.setting_name,
    scs.maintenance_type,
    cs.interval_type,
    cs.kms,
    cs.kms_to_alert,
    cs.days,
    cs.days_to_alert,
    cs.time_unit,
    vsm.last_replaced_km,
    vsm.last_maintenance_date,
    sc.configuration_name
  FROM vehicles v
  INNER JOIN vehicle_scheduled_maintenance vsm
    ON vsm.vehicle = v.id AND vsm.status = 1
  INNER JOIN scheduled_configuration_settings scs
    ON scs.id = vsm.scheduled_maintenance AND scs.status = 1
  INNER JOIN configuration_settings cs
    ON cs.setting = scs.id
    AND cs.configuration = v.vehicle_configuration
    AND cs.status = 1
  LEFT JOIN scheduled_configurations sc
    ON sc.id = cs.configuration
  WHERE v.status = 1
  ORDER BY v.vehicle_number, scs.setting_name
`;

// ── Open defects per vehicle from vehicle_repair_logs ──────────────
export const getActiveDefectsQuery = () => `
  SELECT
    vrl.vehicle AS vehicle_id,
    COUNT(*) AS open_defect_count,
    JSON_ARRAYAGG(
      JSON_OBJECT(
        'defect_id',    vrl.id,
        'description',  vrl.repair_desc,
        'issue_type',   vrl.issue_type,
        'defect_status',vrl.defect_status,
        'defect_source',vrl.defect_source,
        'issue_date',   vrl.issue_date,
        'category',     rcc.repair_code_category
      )
    ) AS defects
  FROM vehicle_repair_logs vrl
  LEFT JOIN repair_code_categories rcc
    ON rcc.id = vrl.repair_code_category
  WHERE vrl.defect_status NOT IN (
    'Completed', 'Repair_Not_Required', 'Rejected', 'Ro_Cancelled'
  )
  AND (vrl.is_duplicate IS NULL OR vrl.is_duplicate = 'n')
  GROUP BY vrl.vehicle
`;

// ── Active repair orders + work order numbers per vehicle ──────────
export const getActiveRepairOrdersQuery = () => `
  SELECT
    rpo.vehicle AS vehicle_id,
    COUNT(DISTINCT rpo.id) AS active_ro_count,
    JSON_ARRAYAGG(
      JSON_OBJECT(
        'ro_id',              rpo.id,
        'work_order_number',  rpo.work_order_number,
        'invoice_number',     rpo.invoice_number,
        'work_order_status',  rpo.work_order_status,
        'vehicle_status',     rpo.vehicle_status,
        'invoice_paid_status',rpo.invoice_paid_status,
        'vendor_name',        vd.vendor_name,
        'total_labor_cost',   rpo.total_labor_cost,
        'total_parts_cost',   rpo.total_parts_cost,
        'total_total_cost',   rpo.total_total_cost,
        'line_items',         (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'rpor_id',      rpor.id,
              'item_type',    rpor.item_type,
              'rpor_status',  rpor.rpor_status,
              'labor_cost',   rpor.labor_cost,
              'parts_cost',   rpor.parts_cost,
              'total_cost',   rpor.total_cost,
              'work_order_number', rpor.work_order_number,
              'invoice_status',    rpor.invoice_status,
              'repair_notes', rpor.repair_notes
            )
          )
          FROM repair_purchase_order_repairs rpor
          WHERE rpor.repair_purchase_order = rpo.id
            AND rpor.rpor_status NOT IN (
              'Completed', 'Rejected', 'Repair_Not_Required', 'Ro_Cancelled'
            )
        )
      )
    ) AS repair_orders
  FROM repair_purchase_orders rpo
  LEFT JOIN vendors vd ON vd.id = rpo.vendor
  WHERE rpo.status IN (1, 2)
  GROUP BY rpo.vehicle
`;