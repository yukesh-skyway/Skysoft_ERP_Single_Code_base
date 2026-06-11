const BASE_QUERY = `
  SELECT
    u.id AS driver_id, u.fullname, u.email, u.user_phone,
    u.user_alternate_phone, u.status AS user_status,
    u.date_of_birth, u.gender, u.nickname, u.last_login,
    dp.driver_code, dp.driver_licence_no, dp.driver_license_issue,
    dp.driver_licence_expiry, dp.driver_class, dp.driver_medical_due,
    dp.driver_abstract, dp.driver_abstract_issue, dp.driver_abstract_expiry,
    dp.driver_language, dp.driver_preferred_route,
    dp.driver_excluded_route, dp.driver_uniform_size, dp.driver_position,
    dp.driver_location, dp.driving_hiring, dp.is_dummy_driver,
    dp.driver_passport_required, dp.driver_work_visa_required,
    dp.driver_passport_name, dp.driver_passport_number,
    dp.driver_passport_issue, dp.driver_passport_expiry,
    dp.driver_visa_number, dp.driver_visa_issuedate, dp.driver_visa_expirydate,
    dg.dgrp_name AS driver_group_name,
    dg.dgrp_desc AS driver_group_desc,
    dt.dtype_name AS driver_type_name,
    dt.dtype_country AS driver_type_country,
    dgr.dg_name AS driver_grade_name,
    dr.drank_name AS driver_ranking,
    dsl.dsl_level AS seniority_level,
    dlc.dlc_name AS license_class_name,
    dlc.dlc_desc AS license_class_desc,
    ddp.dpsp_name AS preferred_dispatch_pattern,
    u.motive_userid, u.motive_username, u.motive_licence_number
  FROM users u
  LEFT JOIN driver_profile dp ON dp.driver_id = u.id
  LEFT JOIN driver_groups dg ON dg.dgrp_id = dp.driver_group
  LEFT JOIN driver_types dt ON dt.dtype_id = dp.driver_type
  LEFT JOIN driver_grades dgr ON dgr.dg_id = dp.driver_grade
  LEFT JOIN driver_ranking dr ON dr.drank_id = dp.driver_ranking_category
  LEFT JOIN driver_seniority_levels dsl ON dsl.dsl_id = dp.driver_seniority
  LEFT JOIN driver_license_class dlc ON dlc.dlc_id = CAST(dp.driver_class AS UNSIGNED)
  LEFT JOIN driver_preferred_dispatch_pattern ddp ON ddp.dpsp_id = dp.driver_dispatch_pattern
  WHERE u.status = 1
    AND dp.driver_id IS NOT NULL
    AND dp.is_dummy_driver = 0
`;

export const getAllDriversQuery = () =>
  BASE_QUERY + ` ORDER BY u.fullname ASC`;

export const getSingleDriverQuery = () =>
  BASE_QUERY + ` AND u.id = ? LIMIT 1`;