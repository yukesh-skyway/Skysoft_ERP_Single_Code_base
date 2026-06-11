const CONTRACT_BASE_QUERY = `
  SELECT
    -- Contract core
    c.id AS contract_id,
    c.contract_start_date,
    c.contract_end_date,
    c.no_of_vehicles,
    c.no_of_drivers,
    c.contract_description,
    c.status AS contract_status,
    c.contract_base_amount,
    c.contract_tax_amount,
    c.contract_total_amount,

    -- Client
    cl.id AS client_id,
    cl.client_name,
    cl.email AS client_email,
    cl.phone AS client_phone,

    -- Sales rep
    sr.id AS sales_rep_id,
    sr.fullname AS sales_rep_name,
    sr.email AS sales_rep_email,

    -- Segment
    cs.id AS segment_id,
    cs.segment_start_date,
    cs.segment_end_date,
    cs.segment_vehicle_count,
    cs.segment_base_cost,
    cs.segment_tax,
    cs.segment_final_cost,
    cs.segment_days,
    cs.segment_kms,
    cs.segment_driver_notes,
    cs.segment_customer_notes,
    cs.segment_status,

    -- Pricing
    cp.id AS pricing_id,
    cp.pricing_name,
    cp.pricing_type,
    cp.unit_price,
    cp.with_driver,
    cp.with_fuel,
    cp.total_kms AS pricing_total_kms,

    -- Slot booking
    sb.id AS slot_booking_id,
    sb.booking_trip_date,
    sb.booking_type,
    sb.status AS slot_status,

    -- Slot
    sl.id AS slot_id,
    sl.slot_name,
    sl.slot_type,

    -- Driver assignment
    tds.id AS driver_schedule_id,
    tds.trip_date AS driver_trip_date,
    tds.pay_amount AS driver_pay_amount,
    tds.status AS driver_schedule_status,
    tds.trip_confirmed,
    tds.leg_assigned,

    -- Driver (user)
    du.id AS driver_id,
    du.fullname AS driver_name,
    du.user_phone AS driver_phone,
    du.email AS driver_email,

    -- Driver leg info
    dl.leg_no,
    dl.leg_distance,
    dl.leg_status,

    -- Vehicle assignment
    tvs.id AS vehicle_schedule_id,
    tvs.trip_date AS vehicle_trip_date,
    tvs.status AS vehicle_schedule_status,

    -- Vehicle
    v.id AS vehicle_id,
    v.vehicle_nickname,
    v.vehicle_number,
    v.current_km,
    v.status AS vehicle_status,

    -- Trip
    t.id AS trip_id,
    t.trip_description,
    t.trip_driver_notes,
    t.trip_customer_notes,
    t.trip_advance,
    t.status AS trip_status,

    -- Segment charges
    sc.id AS charge_id,
    sc.charge_type,
    sc.unit_price AS charge_unit_price,
    sc.total_units,
    sc.item_cost

  FROM contracts c

  -- Client
  JOIN clients cl ON cl.id = c.client

  -- Sales rep
  JOIN users sr ON sr.id = c.sales_rep

  -- Segments
  LEFT JOIN contract_segments cs ON cs.contract_id = c.id

  -- Pricing config for segment
  LEFT JOIN contract_pricing cp ON cp.id = cs.segment_pricing

  -- Slot bookings for this segment
  LEFT JOIN slot_bookings sb ON sb.segment = cs.id
    AND sb.booking_type = 'CONTRACT'
    AND sb.status != 3

  -- Slot details
  LEFT JOIN slots sl ON sl.id = sb.slot

  -- Driver schedule per slot booking date
  LEFT JOIN trip_driver_schedule tds ON tds.segment = cs.id
    AND tds.booked_slot = sb.slot
    AND tds.trip_date = sb.booking_trip_date
    AND tds.status = 'CONFIRMED'

  -- Driver user info
  LEFT JOIN users du ON du.id = tds.driver

  -- Driver leg info
  LEFT JOIN driver_legs dl ON dl.leg_id = tds.leg_assigned

  -- Vehicle schedule per slot booking date
  LEFT JOIN trip_vehicle_schedule tvs ON tvs.segment = cs.id
    AND tvs.booked_slot = sb.slot
    AND tvs.trip_date = sb.booking_trip_date
    AND tvs.status = 'CONFIRMED'

  -- Vehicle info
  LEFT JOIN vehicles v ON v.id = tvs.vehicle

  -- Trip linked to segment's quote (via contract)
  LEFT JOIN trips t ON t.quote_id = c.id

  -- Segment charges
  LEFT JOIN segment_charges sc ON sc.segment_id = cs.id

  WHERE c.status != 'CANCELED'
`;

export const getAllContractsQuery = () =>
  CONTRACT_BASE_QUERY + ` ORDER BY c.id DESC, cs.segment_start_date ASC`;

export const getSingleContractQuery = () =>
  CONTRACT_BASE_QUERY + ` AND c.id = ? ORDER BY cs.segment_start_date ASC`;

export const getContractsByClientQuery = () =>
  CONTRACT_BASE_QUERY + ` AND c.client = ? ORDER BY c.id DESC`;