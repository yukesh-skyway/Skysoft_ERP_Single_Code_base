// ============================================================
// SkyWayHub — CONTRACT MODULE
// Paste into https://dbdiagram.io/d
// Enums simplified to base types; key allowed values noted inline.
// ============================================================

// ---------- CONTRACT CORE ----------
Table contracts {
  id int [pk, increment]
  client int [not null]
  contact int [not null]
  sales_rep int [not null]
  contract_start_date date
  contract_end_date date
  no_of_vehicles int
  no_of_drivers int
  contract_description text
  is_hst tinyint [note: '1=Available, 2=Not Available']
  contract_base_amount double
  contract_tax_amount double
  contract_total_amount double
  status varchar [note: 'SCHEDULED/ONRUN/FINISHED/CANCELED']
  tax_applicable int
  tax_reference_id int [note: 'from company_setting/tax_setting']
  status_updated_by int
  status_updated_on datetime
  created_by int
  created_on timestamp
}

Table contract_vehicle_types {
  id int [pk, increment]
  contract_id int [not null]
  vehicle_type_id int [not null]
}

Table contract_segments {
  id int [pk, increment]
  contract_id int [not null]
  segment_pricing int [note: '-> contract_pricing.id']
  segment_start_date date
  segment_end_date date
  is_hst tinyint
  segment_vehicle_count int
  segment_base_cost double
  segment_tax double
  segment_final_cost double
  segment_days int
  segment_kms double
  segment_total_expenses double
  tax_applicable int
  tax_reference_id int
  created_by int
  created_on timestamp
  segment_status tinyint [note: '1=Active,2=Finished,3=Canceled']
}

Table contract_logs {
  id int [pk, increment]
  contract_id int [not null]
  segment_id int
  user_id int [not null]
  log_data text
  log_time timestamp
}

// ---------- PRICING ----------
Table contract_pricing {
  id int [pk, increment]
  pricing_name varchar
  contract_id int [note: 'NULL when is_library=yes']
  vehicle_type int [not null]
  pricing_type varchar [note: 'HOURLY/DAILY/WEEKLY/SEMIMONTHLY/MONTHLY/CUSTOM/KMS']
  invoice_item int
  with_driver tinyint
  no_of_drivers int
  with_fuel tinyint
  unit_price double
  total_kms double
  weekdays varchar
  vechile_collection int
  vechile_sub_collection int
  is_library varchar [note: 'yes/no']
  valid_for_client varchar
  applicable_on varchar [note: 'contract/charter/both']
  leg_type varchar [note: 'switch/together']
  cp_pay_type int [note: '-> employee_pay_types (single-driver case)']
  route_id int [note: '-> routes_planning.pr_id']
  created_by int
  updated_by int
  updated_on timestamp
}

Table contract_pricing_additional_charges {
  id int [pk, increment]
  contract_pricing_id int [not null]
  additional_charges_mode varchar [note: 'KMS/HOURS/BOTH']
  allowed_kms double
  additional_km_rate double
  allowed_hours double
  additional_hour_rate double
}

Table contract_pricing_custom {
  id int [pk, increment]
  contract_pricing_id int [not null]
  no_of_days int
}

Table contract_pricing_hourly {
  id int [pk, increment]
  contract_pricing_id int [not null]
  minimum_hours double
  minimum_charge double
}

Table contract_pricing_routes {
  id int [pk, increment]
  contract_pricing_id int [not null]
  route_location int [note: '-> locations.id']
  route_type varchar [note: 'START/END/ROUTE']
  route_order int
}

Table pricing_config_tripitems {
  pci_id bigint [pk, increment]
  pci_configid int [not null, note: 'FK -> contract_pricing.id']
  pci_checklist_type varchar [note: 'pretrip/triptime/posttrip(+_compliance)']
  pci_checklist_id int [note: '-> pretrip/triptime/posttrip_items']
  pci_occurence varchar [note: 'daily/once']
  pci_leg_id int [note: '-> driver_legs.leg_id']
  pci_type varchar [note: 'general/legrelated']
  pci_status varchar
  pci_added_by int
}

Table pricing_config_seg_tripitems {
  pcsi_id bigint [pk, increment]
  pcsi_configid int [not null, note: 'FK -> contract_pricing.id']
  pcsi_checklist_type varchar
  pcsi_checklist_id int
  pcsi_occurence varchar
  pcsi_segment int [note: '-> contract_segments.id']
  pcsi_leg_id int [note: '-> driver_legs.leg_id']
  driver_id int [note: '-> users.id']
  pcsi_status varchar
  pcsi_added_by int
}

// ---------- DRIVER LEGS ----------
Table driver_legs {
  leg_id int [pk, increment]
  leg_no varchar
  contract_pricing_id int [not null]
  route_location_start int [note: '-> locations.id (or switch_locations)']
  route_location_end int
  leg_distance double
  pay_type int [note: '-> employee_pay_types.id']
  leg_status varchar [note: 'active/canceled']
  dl_previous_legid int [note: 'self-ref, edited leg']
  added_by int
  added_on datetime
}

// ---------- SEGMENT FINANCIALS ----------
Table segment_charges {
  id int [pk, increment]
  segment_id int [not null]
  charge_type varchar [note: 'HOURLY/DAILY/.../EXTRA_KM/EXTRA_HOUR/KMS']
  slot_booking int [note: '-> slot_bookings.id']
  unit_price double
  total_units float
  item_cost double
  updated_by int
  updated_on timestamp
}

Table segment_internal_costs {
  id int [pk, increment]
  segment_id int [not null]
  segment_fuel double
  segment_wear_tire double
  segment_cca double
  segment_insurance double
  segment_driver_wages double
  segment_operating_cost double
  ic_used varchar [note: 'SEGMENT/CUSTOM']
}

Table segment_adjustments {
  id int [pk, increment]
  segment_id int [not null]
  adjustment_type varchar [note: 'ADD/SUB/CREDIT_MEMO/WRITE_OFF/GRATUITIES']
  adjustment_reason int
  adjustment_amount double
  adjustment_description varchar
  added_by int
  added_on timestamp
}

Table segment_files {
  id int [pk, increment]
  segment_id int [not null]
  filename_original varchar
  filename varchar
  uploaded_by int
  file_uploaded timestamp
}

// ---------- SLOTS ----------
Table slots {
  id int [pk, increment]
  slot_name varchar
  slot_type varchar [note: 'INTERNAL/OUTSOURCE']
  vehicle_collection int
  vehicle_sub_collection int
  vehicle_type int
  slot_order int
  status int
}

Table slot_configuration {
  id int [pk, increment]
  slot_id int [not null]
  slot_config_type varchar [note: 'CHARTER/CONTRACT']
  config_valid_from date
  config_valid_to date
  created_by int
  created_on timestamp
}

Table slot_configuration_logs {
  id int [pk, increment]
  slot_configuration int [not null]
  log_message text
  action_by int
  action_time timestamp
}

Table slot_bookings {
  id int [pk, increment]
  quote int [note: '-> quotes.id (0 for contract)']
  segment int [note: '-> contract_segments.id (0 for charter)']
  slot int [note: '-> slots.id']
  booking_trip_date date
  day int
  month int
  year int
  booking_type varchar [note: 'CHARTER/CONTRACT']
  status tinyint [note: '1=Allocated,2=Confirmed,3=Cancelled']
  is_wheelchair_required varchar
  vehicle_leg_assigned_json text
}

Table slot_booking_hourly {
  id int [pk, increment]
  slot_booking int [not null]
  day date
  hour int [note: '1-24']
  booked_by int
  booked_on timestamp
}

Table slot_engagements {
  id int [pk, increment]
  slot_id int [not null]
  quote_id int [not null]
  engaged_from timestamp
  engaged_to timestamp
  updated_by int
}

Table slot_history {
  sh_id int [pk, increment]
  sh_slot_id int [not null]
  sh_slot_old_name varchar
  sh_slot_new_name varchar
  sh_updated_by int
  sh_updated_on datetime
}

Table kms_hours_usage {
  id int [pk, increment]
  slot_booking int [not null]
  start_km double
  end_km double
  kms_difference double
  start_hour time
  end_hour time
  updated_by int
}

// ---------- TRIP SCHEDULING (driver/vehicle binding) ----------
Table trips {
  id int [pk, increment]
  quote_id int [not null]
  trip_id varchar
  trip_advance double
  assigned tinyint
  status varchar [note: 'SCHEDULED/ONRUN/FINISHED/CANCELED']
  created_by int
  created_on timestamp
}

Table trip_driver_schedule {
  id int [pk, increment]
  trip int [note: '-> trips.id (0 if contract)']
  segment int [note: '-> contract_segments.id (0 if charter)']
  driver int [not null, note: '-> users.id']
  booked_slot int [not null, note: '-> slot_bookings.id']
  trip_date date
  pay_amount double
  is_paid varchar
  leg_assigned int [note: '-> driver_legs.leg_id']
  status varchar [note: 'CONFIRMED/CANCELED']
  trip_confirmed varchar
  scheduled_by int
  confirmed_by int
  canceled_by int
}

Table trip_vehicle_schedule {
  id int [pk, increment]
  trip int [note: '-> trips.id']
  segment int [note: '-> contract_segments.id']
  vehicle int [not null, note: '-> vehicles.id']
  booked_slot int [not null, note: '-> slot_bookings.id']
  trip_date date
  status varchar [note: 'CONFIRMED/CANCELED']
  scheduled_by int
  canceled_by int
}

Table trip_outsource_schedule {
  id int [pk, increment]
  trip int [not null]
  outsourced_to int [not null, note: '-> outsourcing_companies.id']
  booked_slot int [not null, note: '-> slot_bookings.id']
  trip_date date
  outsource_cost double
  outsourcing_reason int
  is_paid varchar
  status varchar
  scheduled_by int
}

Table trip_vehicle_kilometer {
  id int [pk, increment]
  trip int [not null]
  segment_id int [note: '-> contract_segments.id']
  vehicle int [not null]
  trip_day date
  kms_start double
  kms_end double
  kms_difference double
  logged_by int
}

// ============================================================
// LINKED REFERENCE TABLES (stubs — key columns only)
// ============================================================
Table clients {
  id int [pk, increment]
  client_number varchar
  client_name varchar
}

Table contacts {
  id int [pk, increment]
  client_id int
  contact_name varchar
}

Table users {
  id int [pk, increment]
  email varchar
  fullname varchar
  role varchar
}

Table vehicletypes {
  id int [pk, increment]
  vc_id int
  vsc_id int
  vehicle_type varchar
}

Table vehicles {
  id int [pk, increment]
  vehicle_nickname varchar
  vehicle_number varchar
  vehicle_type int
}

Table vehicles_collections {
  id int [pk, increment]
  name varchar
}

Table vehicles_sub_collections {
  id int [pk, increment]
  vc_id int
  name varchar
}

Table invoice_items {
  id int [pk, increment]
  invoice_item varchar
  vehicle_type_id int
}

Table locations {
  id int [pk, increment]
  location_name varchar
  lat decimal
  lng decimal
}

Table routes_planning {
  pr_id int [pk, increment]
  pr_route_name varchar
  pr_route_number varchar
}

Table employee_pay_types {
  id int [pk, increment]
  pay_type varchar
}

Table outsourcing_companies {
  id int [pk, increment]
  company_name varchar
}

Table outsourcing_reasons {
  id int [pk, increment]
  outsourcing_reason varchar
}

Table quotes {
  id int [pk, increment]
  job int
  client int
  trip_type varchar
}

Table pretrip_items {
  id int [pk, increment]
  pretrip_item_name varchar
}

Table triptime_items {
  triptime_id int [pk, increment]
  triptime_item_name varchar
}

Table posttrip_items {
  id int [pk, increment]
  posttrip_item_name varchar
}

// ============================================================
// RELATIONSHIPS  (child.fk > parent.pk)
// ============================================================
// contract core
Ref: contracts.client > clients.id
Ref: contracts.contact > contacts.id
Ref: contracts.sales_rep > users.id
Ref: contracts.created_by > users.id
Ref: contract_vehicle_types.contract_id > contracts.id
Ref: contract_vehicle_types.vehicle_type_id > vehicletypes.id
Ref: contract_segments.contract_id > contracts.id
Ref: contract_segments.segment_pricing > contract_pricing.id
Ref: contract_segments.created_by > users.id
Ref: contract_logs.contract_id > contracts.id
Ref: contract_logs.segment_id > contract_segments.id
Ref: contract_logs.user_id > users.id

// pricing
Ref: contract_pricing.contract_id > contracts.id
Ref: contract_pricing.vehicle_type > vehicletypes.id
Ref: contract_pricing.invoice_item > invoice_items.id
Ref: contract_pricing.route_id > routes_planning.pr_id
Ref: contract_pricing.vechile_collection > vehicles_collections.id
Ref: contract_pricing.vechile_sub_collection > vehicles_sub_collections.id
Ref: contract_pricing.cp_pay_type > employee_pay_types.id
Ref: contract_pricing.created_by > users.id
Ref: contract_pricing_additional_charges.contract_pricing_id > contract_pricing.id
Ref: contract_pricing_custom.contract_pricing_id > contract_pricing.id
Ref: contract_pricing_hourly.contract_pricing_id > contract_pricing.id
Ref: contract_pricing_routes.contract_pricing_id > contract_pricing.id
Ref: contract_pricing_routes.route_location > locations.id

// trip item config (hard FKs)
Ref: pricing_config_tripitems.pci_configid > contract_pricing.id
Ref: pricing_config_tripitems.pci_leg_id > driver_legs.leg_id
Ref: pricing_config_seg_tripitems.pcsi_configid > contract_pricing.id
Ref: pricing_config_seg_tripitems.pcsi_segment > contract_segments.id
Ref: pricing_config_seg_tripitems.pcsi_leg_id > driver_legs.leg_id
Ref: pricing_config_seg_tripitems.driver_id > users.id

// legs
Ref: driver_legs.contract_pricing_id > contract_pricing.id
Ref: driver_legs.route_location_start > locations.id
Ref: driver_legs.route_location_end > locations.id
Ref: driver_legs.pay_type > employee_pay_types.id
Ref: driver_legs.added_by > users.id
Ref: driver_legs.dl_previous_legid > driver_legs.leg_id

// segment financials
Ref: segment_charges.segment_id > contract_segments.id
Ref: segment_charges.slot_booking > slot_bookings.id
Ref: segment_internal_costs.segment_id > contract_segments.id
Ref: segment_adjustments.segment_id > contract_segments.id
Ref: segment_adjustments.added_by > users.id
Ref: segment_files.segment_id > contract_segments.id
Ref: segment_files.uploaded_by > users.id

// slots
Ref: slots.vehicle_collection > vehicles_collections.id
Ref: slots.vehicle_sub_collection > vehicles_sub_collections.id
Ref: slots.vehicle_type > vehicletypes.id
Ref: slot_configuration.slot_id > slots.id
Ref: slot_configuration.created_by > users.id
Ref: slot_configuration_logs.slot_configuration > slot_configuration.id
Ref: slot_configuration_logs.action_by > users.id
Ref: slot_bookings.slot > slots.id
Ref: slot_bookings.segment > contract_segments.id
Ref: slot_bookings.quote > quotes.id
Ref: slot_booking_hourly.slot_booking > slot_bookings.id
Ref: slot_booking_hourly.booked_by > users.id
Ref: slot_engagements.slot_id > slots.id
Ref: slot_engagements.quote_id > quotes.id
Ref: slot_history.sh_slot_id > slots.id
Ref: kms_hours_usage.slot_booking > slot_bookings.id

// trip scheduling — the driver/vehicle binding
Ref: trips.quote_id > quotes.id
Ref: trip_driver_schedule.trip > trips.id
Ref: trip_driver_schedule.segment > contract_segments.id
Ref: trip_driver_schedule.driver > users.id
Ref: trip_driver_schedule.booked_slot > slot_bookings.id
Ref: trip_driver_schedule.leg_assigned > driver_legs.leg_id
Ref: trip_driver_schedule.scheduled_by > users.id
Ref: trip_vehicle_schedule.trip > trips.id
Ref: trip_vehicle_schedule.segment > contract_segments.id
Ref: trip_vehicle_schedule.vehicle > vehicles.id
Ref: trip_vehicle_schedule.booked_slot > slot_bookings.id
Ref: trip_outsource_schedule.trip > trips.id
Ref: trip_outsource_schedule.outsourced_to > outsourcing_companies.id
Ref: trip_outsource_schedule.booked_slot > slot_bookings.id
Ref: trip_outsource_schedule.outsourcing_reason > outsourcing_reasons.id
Ref: trip_vehicle_kilometer.trip > trips.id
Ref: trip_vehicle_kilometer.segment_id > contract_segments.id
Ref: trip_vehicle_kilometer.vehicle > vehicles.id

// trip item checklist masters
Ref: pricing_config_tripitems.pci_checklist_id > pretrip_items.id

// table groups
TableGroup contract_core {
  contracts
  contract_vehicle_types
  contract_segments
  contract_logs
}
TableGroup pricing {
  contract_pricing
  contract_pricing_additional_charges
  contract_pricing_custom
  contract_pricing_hourly
  contract_pricing_routes
  pricing_config_tripitems
  pricing_config_seg_tripitems
  driver_legs
}
TableGroup segment_financials {
  segment_charges
  segment_internal_costs
  segment_adjustments
  segment_files
}
TableGroup slots {
  slots
  slot_configuration
  slot_configuration_logs
  slot_bookings
  slot_booking_hourly
  slot_engagements
  slot_history
  kms_hours_usage
}
TableGroup scheduling {
  trips
  trip_driver_schedule
  trip_vehicle_schedule
  trip_outsource_schedule
  trip_vehicle_kilometer
}