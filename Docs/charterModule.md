// ============================================================
// SkyWayHub — CHARTER / QUOTE MODULE
// Paste into https://dbdiagram.io/d
// ============================================================

// ---------- JOB + QUOTE CORE ----------
Table jobs {
  id int [pk, increment]
  client int [not null, note: '-> clients.id']
  job_nickname varchar
  job_cost double
  job_pending_amount double
  job_payment_summary double
  job_profit double
  created_by int [note: '-> users.id']
  created_by_auto_captured int
  created_on timestamp
  last_action_by int
  last_action_time timestamp
  status tinyint [note: '1=Active,2=Finished,3=Cancelled,4=Missed']
}

Table quotes {
  id int [pk, increment]
  job int [not null, note: '-> jobs.id']
  trip_number int
  client int [not null, note: '-> clients.id']
  contact int [note: '-> contacts.id']
  trip_type varchar
  long_distance tinyint
  no_of_coaches int
  trip_start datetime
  trip_end datetime
  trip_from int [note: '-> locations.id']
  trip_to int [note: '-> locations.id']
  total_kms double
  days double
  no_of_drivers int
  return_departure datetime
  slot_expiry datetime
  tolls double
  accomodation double
  parking double
  special_permits double
  traveling_other double
  pricing_option_html text [note: 'snapshot of pricing options']
  vechile_collection int [note: '-> vehicles_collections.id']
  vechile_sub_collection int [note: '-> vehicles_sub_collections.id']
  vehicle_type int [not null, note: '-> vehicletypes.id']
  final_quote_value_exgst double
  discount double
  additions double
  final_price double
  itinerary text [note: 'legacy flat itinerary text']
  trip_return tinyint
  quote_fuel double
  quote_wear_tire double
  quote_cca double
  quote_insurance double
  quote_driver_wages double
  quote_total_expense double
  lead_source int [note: '-> lead_sources.id']
  tax_applicable int
  tax_amount float
  tax_reference_id int [note: '-> tax_setting.tax_id']
  hour_utilized_per_day int
  status varchar [note: 'ACTIVE/MISSED/CONFIRM/VOID/CANCELED/FINISHED']
  status_action_reason int [note: '-> action_reasons.id']
  status_action_desc varchar
  status_updated_by int
  status_updated_on datetime
  created_by int [note: '-> users.id']
  created_on datetime
}

Table quote_stopovers {
  id int [pk, increment]
  quote_id int [not null, note: '-> quotes.id']
  location_id int [not null, note: '-> locations.id']
}

Table itinerary {
  id int [pk, increment]
  quote_id int [not null, note: '-> quotes.id']
  action varchar [note: 'LEAVE_YARD/PICK_UP/DROP_OFF/RETURN_TO_YARD/OTHER']
  action_notes text
  location_id int [note: '-> locations.id']
  estimated_time timestamp
  estimated_kms double
  is_halt tinyint
  updated_by int [note: '-> users.id']
  updated_on timestamp
}

Table quote_followups {
  id int [pk, increment]
  quote_id int [not null, note: '-> quotes.id']
  user_id int [not null, note: '-> users.id']
  scheduled datetime
  subtotal double
  hst double
  tax_reference_id int
  tax_amount float
  total double
  notes text
  status varchar [note: 'ACTIVE/EXPIRED']
  last_updated datetime
}

Table quote_logs {
  id int [pk, increment]
  quote_id int [not null, note: '-> quotes.id']
  user_id int [not null, note: '-> users.id']
  log_data text
  log_time timestamp
}

Table internal_costs {
  id int [pk, increment]
  quote_id int [not null, note: 'UNIQUE -> quotes.id']
  quote_fuel double
  quote_wear_tire double
  quote_cca double
  quote_insurance double
  quote_driver_wages double
  kms_fuel double
  kms_wear_tire double
  kms_cca double
  kms_insurance double
  kms_driver_wages double
  custom_fuel double
  custom_wear_tire double
  custom_cca double
  custom_insurance double
  custom_driver_wages double
  ic_used varchar [note: 'QUOTE/KMS/CUSTOM']
}

// ---------- TRIPS (operational record) ----------
Table trips {
  id int [pk, increment]
  quote_id int [not null, note: 'UNIQUE -> quotes.id']
  trip_id varchar
  trip_visibility tinyint
  trip_description text
  trip_customer_notes text
  trip_driver_notes text
  trip_other_notes text
  trip_advance double
  trip_advance_due_date date
  assigned tinyint
  status varchar [note: 'SCHEDULED/ONRUN/FINISHED/CANCELED']
  created_by int [note: '-> users.id']
  created_on timestamp
}

Table trip_expenses_pre_info {
  id int [pk, increment]
  trip_id int [not null, note: '-> trips.id']
  expense_type_id int [note: '-> expense_types.id']
  pay_by varchar [note: 'CUSTOMER/COMPANY']
  amount double
  currency varchar [note: 'USD/CAD']
}

Table post_trip_adjustments {
  id int [pk, increment]
  trip_id int [not null, note: '-> trips.id']
  adjustment_type varchar [note: 'ADD/SUB/WRITE_OFF/CREDIT_MEMO/GRATUITIES']
  adjustment_reason int [note: '-> addcost_reasons / discount_reasons etc.']
  adjustment_amount_before_tax double
  adjustment_tax double
  adjustment_amount double
  reason varchar
  added_by int [note: '-> users.id']
  added_on timestamp
}

// ---------- VEHICLE TYPE PRICING ----------
Table vehicletypes {
  id int [pk, increment]
  vc_id int [note: '-> vehicles_collections.id']
  vsc_id int [note: '-> vehicles_sub_collections.id']
  vehicle_type varchar
  vehicle_desc text
  fuel_km double
  wear_tire_km double
  cca_per_day double
  insurance_per_day double
  driver_wages double
  operating_cost double
  vehicle_invoice_item varchar
  updated_by int
  updated_on timestamp
}

Table vehicletype_basic_cost {
  vbc_id bigint [pk, increment]
  vbc_vehicle_type int [not null, note: '-> vehicletypes.id']
  vbc_for_year int
  vbc_variable_type varchar
  vbc_variable_display varchar
  vbc_variable_value float
  vbc_pricing_type varchar [note: 'day/km/miles/hourly']
  vbc_updated_by int
  vbc_status varchar [note: '1=active,0=deleted']
}

Table vehicletype_basic_cost_revision {
  vbc_id bigint [pk, increment]
  vbc_revision_id int
  vbc_vehicle_type int [note: '-> vehicletypes.id']
  vbc_for_year int
  vbc_variable_type varchar
  vbc_variable_value float
  vbc_updated_by int
  vbc_status varchar
}

Table vehicletype_variable_rates {
  id int [pk, increment]
  vehicle_type int [not null, note: '-> vehicletypes.id']
  for_year int
  month int
  variable_type varchar [note: 'LOW/HIGH/DKM/US/LD/BOTTOM/SC1/SC2']
  variable_value double
  updated_by int [note: '-> users.id']
  updated_on timestamp
  status varchar
}

Table vehicletype_variable_rates_revision {
  id int [pk, increment]
  revision_id int
  vehicle_type int [note: '-> vehicletypes.id']
  for_year int
  month int
  variable_type varchar
  variable_value double
  updated_by int
  status varchar
}

Table vehicletype_feature_rates {
  id int [pk, increment]
  vehicle_type int [not null, note: '-> vehicletypes.id']
  month int
  feature int [note: '-> vehicle_features.id']
  cost double
}

// ---------- PAYMENTS & BILLING ----------
Table payments {
  id int [pk, increment]
  job_payment_id int
  quote_id int [not null, note: '-> quotes.id']
  job_id int [not null, note: '-> jobs.id']
  segment_id int [note: '-> contract_segments.id (0 if charter)']
  payment_method varchar [note: 'DEBIT_CARD/CREDIT_CARD/CASH/CHEQUE/WIRE_TRANSFER/CREDIT_MEMO/QUOTE/SEGMENT']
  payment_type varchar [note: 'PAYMENT/REFUND']
  payment_details text
  payment_amount double
  payment_status varchar [note: 'IN_PROGRESS/SUCCESS/FAILED']
  payment_notes text
  payment_date date
  payment_received_by int [note: '-> users.id']
}

Table credit_memos {
  id int [pk, increment]
  cm_type varchar [note: 'CREDIT/DEBIT']
  client_id int [note: '-> clients.id']
  trip_adjustment int [note: '-> post_trip_adjustments.id']
  payment_id int [note: '-> payments.id']
  amount double
  source_quote int [note: '-> quotes.id']
  source_segment int [note: '-> contract_segments.id']
  transaction_by int [note: '-> users.id']
  transaction_on timestamp
}

Table creditmemo_refunds {
  id int [pk, increment]
  client_id int [note: '-> clients.id']
  refund_amount double
  credit_memo_reference int [note: 'UNIQUE -> credit_memos.id']
  refund_details text
  refund_by int [note: '-> users.id']
  refund_on timestamp
}

Table gratuities {
  id int [pk, increment]
  gratuities_to int [not null, note: '-> users.id (driver)']
  related_quote int [note: '-> quotes.id']
  related_segment int [note: '-> contract_segments.id']
  gratuity_amount double
  account_transaction_id int
  trip_driver_scheduleid int [note: '-> trip_driver_schedule.id']
  trip_date_gratuity date
  processed_by int [note: '-> users.id']
  processed_on timestamp
}

Table sales_commission {
  id int [pk, increment]
  quote_id int [not null, note: 'UNIQUE -> quotes.id']
  sales_by int [note: '-> users.id']
  data_entry_by int [note: '-> users.id']
  commission_given varchar [note: 'GROSS/REVENUE/MARKUP/CUSTOM']
  sales_rep_commission double
  de_commission double
  used_configuration int [note: '-> sales_commission_configuration.id']
  updated_by int
  status tinyint [note: '1=NotCalc,2=Calc,3=Credited,4=Paid']
}

Table sales_commission_configuration {
  id int [pk, increment]
  role int [note: '-> roles.id']
  from_date date
  to_date date
  gross_exceptional_percentage float
  revenue_exceptional_percentage float
  markup_exceptional_percentage float
  updated_by int
  status tinyint
}

Table sales_commission_configuration_records {
  id int [pk, increment]
  sales_commission_configuration int [note: '-> sales_commission_configuration.id']
  configuration_type varchar [note: 'GROSS/REVENUE/MARKUP']
  from_amount double
  to_amount double
  percentage float
  dataentry_percentage float
  updated_by int
  status tinyint
}

// ---------- SLOTS ----------
Table slots {
  id int [pk, increment]
  slot_name varchar
  slot_type varchar [note: 'INTERNAL/OUTSOURCE']
  vehicle_collection int [note: '-> vehicles_collections.id']
  vehicle_sub_collection int [note: '-> vehicles_sub_collections.id']
  vehicle_type int [note: '-> vehicletypes.id']
  slot_order int
  status int
}

Table slot_configuration {
  id int [pk, increment]
  slot_id int [not null, note: '-> slots.id']
  slot_config_type varchar [note: 'CHARTER/CONTRACT']
  config_valid_from date
  config_valid_to date
  created_by int [note: '-> users.id']
}

Table slot_bookings {
  id int [pk, increment]
  quote int [note: '-> quotes.id (set for charter; 0 for contract)']
  segment int [note: '-> contract_segments.id (0 for charter)']
  slot int [note: '-> slots.id']
  booking_trip_date date
  booking_type varchar [note: 'CHARTER/CONTRACT']
  status tinyint [note: '1=Allocated,2=Confirmed,3=Cancelled']
  is_wheelchair_required varchar
  vehicle_leg_assigned_json text
}

Table slot_booking_hourly {
  id int [pk, increment]
  slot_booking int [not null, note: '-> slot_bookings.id']
  day date
  hour int [note: '1-24']
  booked_by int [note: '-> users.id']
}

Table slot_engagements {
  id int [pk, increment]
  slot_id int [not null, note: '-> slots.id']
  quote_id int [not null, note: '-> quotes.id']
  engaged_from timestamp
  engaged_to timestamp
  itinerary_item_start int [note: '-> itinerary.id']
  itinerary_item_end int [note: '-> itinerary.id']
  updated_by int [note: '-> users.id']
}

Table kms_hours_usage {
  id int [pk, increment]
  slot_booking int [not null, note: '-> slot_bookings.id']
  start_km double
  end_km double
  kms_difference double
  start_hour time
  end_hour time
  updated_by int
}

// ---------- TRIP SCHEDULING ----------
Table trip_driver_schedule {
  id int [pk, increment]
  trip int [not null, note: '-> trips.id']
  segment int [note: '0 for charter']
  driver int [not null, note: '-> users.id']
  booked_slot int [not null, note: '-> slot_bookings.id']
  trip_date date
  pay_amount double
  is_paid varchar [note: 'YES/NO']
  leg_assigned int [note: '-> driver_legs.leg_id (contract only)']
  status varchar [note: 'CONFIRMED/CANCELED']
  trip_confirmed varchar
  scheduled_by int [note: '-> users.id']
  confirmed_by int
  canceled_by int
}

Table trip_vehicle_schedule {
  id int [pk, increment]
  trip int [note: '-> trips.id']
  segment int [note: '0 for charter']
  vehicle int [not null, note: '-> vehicles.id']
  booked_slot int [not null, note: '-> slot_bookings.id']
  trip_date date
  status varchar [note: 'CONFIRMED/CANCELED']
  scheduled_by int [note: '-> users.id']
  canceled_by int
}

Table trip_outsource_schedule {
  id int [pk, increment]
  trip int [not null, note: '-> trips.id']
  outsourced_to int [not null, note: '-> outsourcing_companies.id']
  booked_slot int [not null, note: '-> slot_bookings.id']
  trip_date date
  outsource_cost double
  outsourcing_reason int [note: '-> outsourcing_reasons.id']
  is_paid varchar
  status varchar
  scheduled_by int
}

Table trip_vehicle_kilometer {
  id int [pk, increment]
  trip int [not null, note: '-> trips.id']
  segment_id int [note: '0 for charter']
  vehicle int [not null, note: '-> vehicles.id']
  trip_day date
  kms_start double
  kms_end double
  kms_difference double
  logged_by int [note: '-> users.id']
}

// ---------- CHECKLISTS ----------
Table pricing_config_seg_tripitems {
  pcsi_id bigint [pk]
  pcsi_configid int [note: '-> contract_pricing (see Contract diagram)']
  pcsi_segment int [note: '-> contract_segments.id']
  pcsi_checklist_type varchar [note: 'pretrip/triptime/posttrip(+_compliance)']
  pcsi_leg_id int [note: '-> driver_legs.leg_id']
  driver_id int [note: '-> users.id']
  pcsi_status varchar
}

Table pretrip_items {
  id int [pk, increment]
  pretrip_item_name varchar
  group_id int [note: '-> audit_groups.id']
  apply_to varchar [note: 'CHARTER/CONTRACT/BOTH']
  pre_item_type varchar [note: 'general/legrelated']
  status tinyint
}

Table pretrip_checklist {
  id int [pk, increment]
  trip_id int [note: '-> trips.id']
  segment_id int [note: '0 for charter']
  pretrip_item int [not null, note: '-> pretrip_items.id']
  salesrep_added int [note: '-> users.id']
  driver_id int [note: '-> users.id']
  leg_id int [note: '-> driver_legs.leg_id']
  fk_seg_pricing_itemid_pk bigint [note: '-> pricing_config_seg_tripitems.pcsi_id']
  prtc_related_quote_id int [note: '-> quotes.id']
  prtc_related_contract_id int
  clerk_audited int [note: '-> users.id']
  clerk_action varchar [note: 'NEW/R/NR/OTH']
  clerk_notes text
  prtc_type varchar [note: 'once/daily']
  prtc_status varchar [note: 'active/deleted']
  display_status varchar
  gen_or_leg varchar [note: 'general/legrelated']
  added_on datetime
  audited_on datetime
}

Table triptime_items {
  triptime_id int [pk, increment]
  triptime_item_name varchar
  triptime_group_id int [note: '-> trip_time_audit_groups.trip_time_gid']
  triptime_apply_to varchar [note: 'CHARTER/CONTRACT/BOTH']
  triptime_item_type varchar [note: 'general/legrelated']
  triptime_status tinyint
}

Table triptime_checklist {
  tt_id int [pk, increment]
  tt_trip_id int [note: '-> trips.id']
  tt_segment_id int [note: '0 for charter']
  tt_item int [not null, note: '-> triptime_items.triptime_id']
  tt_salesrep_added int [note: '-> users.id']
  tt_driver_id int [note: '-> users.id']
  tt_leg_id int [note: '-> driver_legs.leg_id']
  fk_seg_pricing_itemid_pk bigint [note: '-> pricing_config_seg_tripitems.pcsi_id']
  tt_related_quote_id int [note: '-> quotes.id']
  tt_related_contract_id int
  tt_clerk_audited int [note: '-> users.id']
  tt_clerk_action varchar [note: 'NEW/R/NR/OTH']
  tt_type varchar [note: 'once/daily']
  tt_status varchar [note: 'active/deleted']
  display_status varchar
  tt_added_on datetime
}

Table posttrip_items {
  id int [pk, increment]
  posttrip_item_name varchar
  posttrip_group_id int [note: '-> post_trip_audit_groups.id']
  apply_to varchar [note: 'CHARTER/CONTRACT/BOTH']
  posttrip_item_type varchar [note: 'general/legrelated']
  is_compulsory varchar
  status tinyint
}

Table posttrip_checklist {
  id int [pk, increment]
  trip_id int [note: '-> trips.id']
  segment_id int [note: '0 for charter']
  posttrip_item int [not null, note: '-> posttrip_items.id']
  salesrep_added int [note: '-> users.id']
  driver_id int [note: '-> users.id']
  leg_id int [note: '-> driver_legs.leg_id']
  fk_seg_pricing_itemid_pk bigint [note: '-> pricing_config_seg_tripitems.pcsi_id']
  ptc_related_quote_id int [note: '-> quotes.id']
  ptc_related_contract_id int
  clerk_audited int [note: '-> users.id']
  clerk_action varchar [note: 'NEW/R/NR/OTH']
  ptc_type varchar [note: 'once/daily']
  ptc_status varchar [note: 'active/deleted']
  display_status varchar
  gen_or_leg varchar
  added_on datetime
}

Table posttrip_performace_checklist {
  id int [pk, increment]
  trip_id int [note: '-> trips.id']
  segment_id int [note: '0 for charter']
  posttrip_performance_item int [note: '-> driver_profile_pr_items.dpi_id']
  driver_id int [not null, note: '-> users.id']
  leg_id int [note: '-> driver_legs.leg_id']
  fk_seg_pricing_config bigint [note: '-> pricing_config_seg_tripitems.pcsi_id']
  ppc_audit_type varchar [note: 'pretrip/posttrip/triptime']
  clerk_audited int [note: '-> users.id']
  clerk_action varchar [note: 'NEW/R/NR/OTH']
  rating_fulfilled varchar [note: 'yes/no/oth']
  ptc_related_quote_id int [note: '-> quotes.id']
  ptc_type varchar [note: 'once/daily']
  ppc_status varchar [note: 'active/deleted']
  display_status varchar
  added_on datetime
}

// ---------- CHECKLIST GROUPS ----------
Table audit_groups {
  id int [pk, increment]
  group_name varchar
  status tinyint
}

Table post_trip_audit_groups {
  id int [pk, increment]
  post_audit_group_name varchar
  status tinyint
}

Table trip_time_audit_groups {
  trip_time_gid int [pk, increment]
  trip_time_audit_group_name varchar
  trip_time_status tinyint
}

Table driver_profile_pr_items {
  dpi_id int [pk, increment]
  dpi_group_id int [note: '-> driver_groups.dgrp_id']
  dpi_name varchar
  dpi_tolerance_level int
  dpi_failing_level int
  dpi_applied_to varchar [note: 'Charter/Contract/Both']
  is_post_trip_item varchar
  is_pre_trip_item varchar
  is_trip_time_item varchar
  dpi_status varchar
}

// ---------- CUSTOMER SURVEY ----------
Table customer_survey {
  id int [pk, increment]
  job int [not null, note: '-> jobs.id']
  customer int [note: '-> contacts.id']
  customer_email varchar
  customer_comments text
  survey_secret varchar
  survey_status tinyint [note: '1=Sent,2=Success']
  survey_on timestamp
}

Table customer_survey_feedback {
  id int [pk, increment]
  survey int [not null, note: '-> customer_survey.id']
  question int [not null, note: '-> survey_questions.id']
  rating tinyint [note: '1-5']
  rated_on timestamp
}

Table survey_questions {
  id int [pk, increment]
  question varchar
  question_order int
  added_by int [note: '-> users.id']
  status tinyint
}

// ---------- COMMUNICATIONS ----------
Table emails {
  id int [pk, increment]
  sender varchar
  receiver varchar
  subject varchar
  message longtext
  quote_id int [note: '-> quotes.id']
  job_id int [note: '-> jobs.id']
  segment_id int [note: '-> contract_segments.id']
  sent_by int [note: '-> users.id']
  sender_id int [note: '-> senders.id']
  is_smtp tinyint
  sent_on timestamp
}

Table files {
  id int [pk, increment]
  quote_id int [not null, note: '-> quotes.id']
  filename_original varchar
  filename varchar
  uploaded_by int [note: '-> users.id']
  file_uploaded timestamp
  status tinyint
}

Table sms_logs {
  id int [pk, increment]
  sms_type varchar [note: 'OUTGOING/INCOMING']
  sms_category varchar [note: 'SECRET_CODE/CUSTOM/QUOTE/SEGMENT']
  sms_message text
  sms_number varchar
  related_quote int [note: '-> quotes.id']
  related_segment int [note: '-> contract_segments.id']
  sms_sent_by int [note: '-> users.id']
  sms_sent_on timestamp
  status varchar
}

// ============================================================
// REFERENCE STUBS
// ============================================================
Table clients {
  id int [pk]
  client_number varchar
  client_name varchar
}

Table contacts {
  id int [pk]
  client_id int
  contact_name varchar
}

Table users {
  id int [pk]
  email varchar
  fullname varchar
  role varchar
}

Table locations {
  id int [pk]
  location_name varchar
  lat decimal
  lng decimal
}

Table vehicles {
  id int [pk]
  vehicle_nickname varchar
  vehicle_number varchar
  vehicle_type int
}

Table vehicles_collections {
  id int [pk]
  name varchar
}

Table vehicles_sub_collections {
  id int [pk]
  vc_id int
  name varchar
}

Table vehicle_features {
  id int [pk]
  feature varchar
}

Table lead_sources {
  id int [pk]
  lead_source varchar
}

Table action_reasons {
  id int [pk]
  action_reason varchar
}

Table outsourcing_companies {
  id int [pk]
  company_name varchar
}

Table outsourcing_reasons {
  id int [pk]
  outsourcing_reason varchar
}

Table expense_types {
  id int [pk]
  expense_type varchar
}

Table tax_setting {
  tax_id int [pk]
  tax_label varchar
  tax_percentage float
}

Table roles {
  id int [pk]
  role_name varchar
}

Table senders {
  id int [pk]
  sender_email varchar
  sender_name varchar
}

Table driver_legs {
  leg_id int [pk]
  contract_pricing_id int
  leg_no varchar
}

Table contract_segments {
  id int [pk]
  contract_id int
  segment_pricing int
}

// ============================================================
// RELATIONSHIPS
// ============================================================

// job + quote core
Ref: quotes.job > jobs.id
Ref: quotes.client > clients.id
Ref: quotes.contact > contacts.id
Ref: quotes.trip_from > locations.id
Ref: quotes.trip_to > locations.id
Ref: quotes.vehicle_type > vehicletypes.id
Ref: quotes.vechile_collection > vehicles_collections.id
Ref: quotes.vechile_sub_collection > vehicles_sub_collections.id
Ref: quotes.lead_source > lead_sources.id
Ref: quotes.status_action_reason > action_reasons.id
Ref: quotes.tax_reference_id > tax_setting.tax_id
Ref: quotes.created_by > users.id
Ref: jobs.client > clients.id
Ref: jobs.created_by > users.id

// quote elaboration
Ref: quote_stopovers.quote_id > quotes.id
Ref: quote_stopovers.location_id > locations.id
Ref: itinerary.quote_id > quotes.id
Ref: itinerary.location_id > locations.id
Ref: itinerary.updated_by > users.id
Ref: internal_costs.quote_id > quotes.id
Ref: quote_followups.quote_id > quotes.id
Ref: quote_followups.user_id > users.id
Ref: quote_logs.quote_id > quotes.id
Ref: quote_logs.user_id > users.id

// trips
Ref: trips.quote_id > quotes.id
Ref: trips.created_by > users.id
Ref: trip_expenses_pre_info.trip_id > trips.id
Ref: trip_expenses_pre_info.expense_type_id > expense_types.id
Ref: post_trip_adjustments.trip_id > trips.id
Ref: post_trip_adjustments.added_by > users.id

// vehicle type pricing
Ref: vehicletypes.vc_id > vehicles_collections.id
Ref: vehicletypes.vsc_id > vehicles_sub_collections.id
Ref: vehicletype_basic_cost.vbc_vehicle_type > vehicletypes.id
Ref: vehicletype_basic_cost_revision.vbc_vehicle_type > vehicletypes.id
Ref: vehicletype_variable_rates.vehicle_type > vehicletypes.id
Ref: vehicletype_variable_rates.updated_by > users.id
Ref: vehicletype_variable_rates_revision.vehicle_type > vehicletypes.id
Ref: vehicletype_feature_rates.vehicle_type > vehicletypes.id
Ref: vehicletype_feature_rates.feature > vehicle_features.id

// payments and billing
Ref: payments.quote_id > quotes.id
Ref: payments.job_id > jobs.id
Ref: payments.payment_received_by > users.id
Ref: credit_memos.client_id > clients.id
Ref: credit_memos.source_quote > quotes.id
Ref: credit_memos.payment_id > payments.id
Ref: credit_memos.trip_adjustment > post_trip_adjustments.id
Ref: credit_memos.transaction_by > users.id
Ref: creditmemo_refunds.credit_memo_reference > credit_memos.id
Ref: creditmemo_refunds.client_id > clients.id
Ref: creditmemo_refunds.refund_by > users.id
Ref: gratuities.related_quote > quotes.id
Ref: gratuities.gratuities_to > users.id
Ref: gratuities.processed_by > users.id
Ref: gratuities.trip_driver_scheduleid > trip_driver_schedule.id
Ref: sales_commission.quote_id > quotes.id
Ref: sales_commission.sales_by > users.id
Ref: sales_commission.data_entry_by > users.id
Ref: sales_commission.used_configuration > sales_commission_configuration.id
Ref: sales_commission_configuration.role > roles.id
Ref: sales_commission_configuration_records.sales_commission_configuration > sales_commission_configuration.id

// slots
Ref: slots.vehicle_collection > vehicles_collections.id
Ref: slots.vehicle_sub_collection > vehicles_sub_collections.id
Ref: slots.vehicle_type > vehicletypes.id
Ref: slot_configuration.slot_id > slots.id
Ref: slot_configuration.created_by > users.id
Ref: slot_bookings.slot > slots.id
Ref: slot_bookings.quote > quotes.id
Ref: slot_bookings.segment > contract_segments.id
Ref: slot_booking_hourly.slot_booking > slot_bookings.id
Ref: slot_booking_hourly.booked_by > users.id
Ref: slot_engagements.slot_id > slots.id
Ref: slot_engagements.quote_id > quotes.id
Ref: slot_engagements.itinerary_item_start > itinerary.id
Ref: slot_engagements.itinerary_item_end > itinerary.id
Ref: slot_engagements.updated_by > users.id
Ref: kms_hours_usage.slot_booking > slot_bookings.id

// trip scheduling
Ref: trip_driver_schedule.trip > trips.id
Ref: trip_driver_schedule.driver > users.id
Ref: trip_driver_schedule.booked_slot > slot_bookings.id
Ref: trip_driver_schedule.leg_assigned > driver_legs.leg_id
Ref: trip_driver_schedule.scheduled_by > users.id
Ref: trip_vehicle_schedule.trip > trips.id
Ref: trip_vehicle_schedule.vehicle > vehicles.id
Ref: trip_vehicle_schedule.booked_slot > slot_bookings.id
Ref: trip_vehicle_schedule.scheduled_by > users.id
Ref: trip_outsource_schedule.trip > trips.id
Ref: trip_outsource_schedule.outsourced_to > outsourcing_companies.id
Ref: trip_outsource_schedule.booked_slot > slot_bookings.id
Ref: trip_outsource_schedule.outsourcing_reason > outsourcing_reasons.id
Ref: trip_vehicle_kilometer.trip > trips.id
Ref: trip_vehicle_kilometer.vehicle > vehicles.id
Ref: trip_vehicle_kilometer.logged_by > users.id

// checklists
Ref: pretrip_checklist.trip_id > trips.id
Ref: pretrip_checklist.pretrip_item > pretrip_items.id
Ref: pretrip_checklist.prtc_related_quote_id > quotes.id
Ref: pretrip_checklist.driver_id > users.id
Ref: pretrip_checklist.leg_id > driver_legs.leg_id
Ref: pretrip_checklist.fk_seg_pricing_itemid_pk > pricing_config_seg_tripitems.pcsi_id
Ref: pretrip_items.group_id > audit_groups.id
Ref: triptime_checklist.tt_trip_id > trips.id
Ref: triptime_checklist.tt_item > triptime_items.triptime_id
Ref: triptime_checklist.tt_related_quote_id > quotes.id
Ref: triptime_checklist.tt_driver_id > users.id
Ref: triptime_checklist.tt_leg_id > driver_legs.leg_id
Ref: triptime_checklist.fk_seg_pricing_itemid_pk > pricing_config_seg_tripitems.pcsi_id
Ref: triptime_items.triptime_group_id > trip_time_audit_groups.trip_time_gid
Ref: posttrip_checklist.trip_id > trips.id
Ref: posttrip_checklist.posttrip_item > posttrip_items.id
Ref: posttrip_checklist.ptc_related_quote_id > quotes.id
Ref: posttrip_checklist.driver_id > users.id
Ref: posttrip_checklist.leg_id > driver_legs.leg_id
Ref: posttrip_checklist.fk_seg_pricing_itemid_pk > pricing_config_seg_tripitems.pcsi_id
Ref: posttrip_items.posttrip_group_id > post_trip_audit_groups.id
Ref: posttrip_performace_checklist.trip_id > trips.id
Ref: posttrip_performace_checklist.driver_id > users.id
Ref: posttrip_performace_checklist.posttrip_performance_item > driver_profile_pr_items.dpi_id
Ref: posttrip_performace_checklist.ptc_related_quote_id > quotes.id
Ref: posttrip_performace_checklist.fk_seg_pricing_config > pricing_config_seg_tripitems.pcsi_id
Ref: pricing_config_seg_tripitems.pcsi_segment > contract_segments.id

// survey
Ref: customer_survey.job > jobs.id
Ref: customer_survey.customer > contacts.id
Ref: customer_survey_feedback.survey > customer_survey.id
Ref: customer_survey_feedback.question > survey_questions.id

// comms
Ref: emails.quote_id > quotes.id
Ref: emails.job_id > jobs.id
Ref: emails.sent_by > users.id
Ref: emails.sender_id > senders.id
Ref: files.quote_id > quotes.id
Ref: files.uploaded_by > users.id
Ref: sms_logs.related_quote > quotes.id
Ref: sms_logs.sms_sent_by > users.id

// ============================================================
// TABLE GROUPS
// ============================================================
TableGroup job_quote_core {
  jobs
  quotes
  quote_stopovers
  itinerary
  quote_followups
  quote_logs
  internal_costs
}

TableGroup trips_ops {
  trips
  trip_expenses_pre_info
  post_trip_adjustments
}

TableGroup vehicle_pricing {
  vehicletypes
  vehicletype_basic_cost
  vehicletype_basic_cost_revision
  vehicletype_variable_rates
  vehicletype_variable_rates_revision
  vehicletype_feature_rates
}

TableGroup payments_billing {
  payments
  credit_memos
  creditmemo_refunds
  gratuities
  sales_commission
  sales_commission_configuration
  sales_commission_configuration_records
}

TableGroup slots_dispatch {
  slots
  slot_configuration
  slot_bookings
  slot_booking_hourly
  slot_engagements
  kms_hours_usage
  trip_driver_schedule
  trip_vehicle_schedule
  trip_outsource_schedule
  trip_vehicle_kilometer
}

TableGroup checklists {
  pretrip_items
  pretrip_checklist
  triptime_items
  triptime_checklist
  posttrip_items
  posttrip_checklist
  posttrip_performace_checklist
  driver_profile_pr_items
  audit_groups
  post_trip_audit_groups
  trip_time_audit_groups
  pricing_config_seg_tripitems
}

TableGroup survey_comms {
  customer_survey
  customer_survey_feedback
  survey_questions
  emails
  files
  sms_logs
}