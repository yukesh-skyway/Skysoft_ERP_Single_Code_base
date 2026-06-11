export function calculateDurationInDays(days, timeUnit) {
  switch ((timeUnit || 'DAYS').toUpperCase()) {
    case 'WEEKS':  return days * 7;
    case 'MONTHS': return days * 30;
    case 'YEARS':  return days * 365;
    default:       return days;
  }
}

export function calculateMaintenanceStatus(row) {
  const today = new Date();
  const currentKm = parseFloat(row.current_km || 0);
  const lastReplacedKm = parseFloat(row.last_replaced_km || 0);
  const lastMaintenanceDate = row.last_maintenance_date;

  let status = 'GOOD';
  let primaryReason = null;
  let actualKmsSinceService = 0;
  let actualDaysSinceService = 0;
  let kmsRemaining = 0;
  let daysRemaining = 0;
  let nextServiceDate = null;

  // KMS based
  if (
    (row.interval_type === 'KMS' || row.interval_type === 'BOTH') &&
    row.kms && row.kms > 0
  ) {
    actualKmsSinceService = currentKm - lastReplacedKm;
    kmsRemaining = row.kms - actualKmsSinceService;

    if (actualKmsSinceService >= row.kms) {
      status = 'OVERDUE';
      primaryReason = 'KMS';
    } else if (row.kms_to_alert && actualKmsSinceService >= row.kms_to_alert) {
      status = 'DUE_SOON';
      primaryReason = 'KMS';
    }
  }

  // Duration based
  if (
    (row.interval_type === 'DURATION' || row.interval_type === 'BOTH') &&
    row.days && row.days > 0 && lastMaintenanceDate
  ) {
    const lastDate = new Date(lastMaintenanceDate);
    const durationInDays = calculateDurationInDays(row.days, row.time_unit);
    const alertInDays = row.days_to_alert
      ? calculateDurationInDays(row.days_to_alert, row.time_unit)
      : 0;

    actualDaysSinceService = Math.floor(
      (today - lastDate) / (1000 * 60 * 60 * 24)
    );
    daysRemaining = durationInDays - actualDaysSinceService;

    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + durationInDays);
    nextServiceDate = nextDate.toISOString().split('T')[0];

    if (actualDaysSinceService >= durationInDays) {
      status = 'OVERDUE';
      primaryReason = row.interval_type === 'BOTH'
        ? primaryReason === 'KMS' ? 'BOTH' : 'DURATION'
        : 'DURATION';
    } else if (alertInDays && actualDaysSinceService >= alertInDays) {
      if (status !== 'OVERDUE') {
        status = 'DUE_SOON';
        primaryReason = row.interval_type === 'BOTH'
          ? primaryReason === 'KMS' ? 'BOTH' : 'DURATION'
          : 'DURATION';
      }
    }
  }

  return {
    status,
    primaryReason,
    actualKmsSinceService,
    actualDaysSinceService,
    kmsRemaining,
    daysRemaining,
    nextServiceDate,
    kmsProgress: row.kms
      ? `${actualKmsSinceService.toLocaleString()} / ${row.kms.toLocaleString()} km`
      : 'N/A',
    daysProgress: row.days
      ? `${actualDaysSinceService} / ${row.days} ${row.time_unit || 'DAYS'}`
      : 'N/A'
  };
}