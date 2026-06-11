// Enterprise-Level Print Template for Repair Orders
// Matches and enhances the PHP version from printrpo.php

interface RepairItem {
  id: number;
  vrlid: number;
  repair_code_category: string;
  repair_desc: string;
  issue_type: string;
  rpor_status: string;
  live_defect_status: string;
  defect_source: string;
  notes: string;
  manager_status: string | null;
  manager_name: string | null;
  manager_update_date: string | null;
  fullname: string | null;
  middlename: string | null;
  lastname: string | null;
  manager_id: number | null;
  reported_by: number | null;
  reported_by_name: string | null;
  motive_driver_username: string | null;
  motive_driver_signed: string | null;
  motive_driver_signed_date: string | null;
  motive_driver_inspection_status: string | null;
  is_duplicate: string;
  merged_count: number;
}

interface ScheduledMaintenanceItem {
  id: number;
  setting_name: string;
  rpor_status: string;
  scheduled_maintenance_setting_id: number;
  repair_purchase_order: number;
  work_order_number: string | null;
  invoice_number: string | null;
  invoice_amount: number | null;
  service_completion_date: string | null;
  current_kms: number | null;
}

interface RODetails {
  rpoid: number;
  vehicle_nickname: string;
  requested_by_name: string;
  kms_before_service: number;
  vendor_name: string;
  vendor_email: string;
  vendor_phone: string;
  estimated_repair_amount: number;
  rpostatus: number;
  repair_notes: string;
  invoice_amount: number;
  work_order_number: string;
  invoice_number: string;
  kms_after_service: number;
  service_completed_date: string;
  payment_method_name: string;
  payment_notes: string;
  attached_invoice_url: string;
  invoice_paid_status: string;
  summary: {
    item_count: number | string;
    status_open_count: number | string;
    status_in_progress_count: number | string;
    status_completed_count: number | string;
    status_repair_not_required_count: number | string;
  };
  repairs: RepairItem[];
  scheduled_maintenance: ScheduledMaintenanceItem[];
}

// Helper to safely escape HTML
const escapeHtml = (text: string | number | null | undefined): string => {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
};

export function generateEnterpriseROPrint(roDetails: RODetails): string {
  const statusLabels: Record<number, string> = {
    1: 'Active',
    2: 'In Progress',
    3: 'Completed',
    4: 'Cancelled'
  };

  const currentStatus = statusLabels[roDetails.rpostatus] || 'Unknown';
  const currentDate = new Date().toLocaleString('en-US', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Build repair line items HTML
  let repairRowsHtml = '';
  let rowNumber = 1;

  if (roDetails.repairs && roDetails.repairs.length > 0) {
    roDetails.repairs.forEach(repair => {
      // Determine who reported the defect
      let reportedBy = 'N/A';
      if (repair.reported_by_name) {
        reportedBy = repair.reported_by_name;
      } else if (repair.motive_driver_username) {
        reportedBy = repair.motive_driver_username;
      }

      // Determine approval information
      let approvedBy = 'N/A';
      let approvalStatus = 'Pending';
      let approvalDate = 'N/A';

      if (repair.defect_source === 'skysoft' && repair.manager_status) {
        // Skysoft defect with manager approval
        if (repair.fullname) {
          approvedBy = repair.fullname;
          if (repair.middlename) approvedBy += ` ${repair.middlename}`;
          if (repair.lastname) approvedBy += ` ${repair.lastname}`;
          if (repair.manager_id) approvedBy += ` (#${repair.manager_id})`;
        }
        approvalStatus = repair.manager_status;
        if (repair.manager_update_date) {
          approvalDate = new Date(repair.manager_update_date).toLocaleString();
        }
      } else if (repair.defect_source === 'motive' && repair.motive_driver_signed) {
        // Motive defect with driver signature
        approvedBy = repair.motive_driver_signed;
        approvalStatus = repair.motive_driver_inspection_status || 'Signed';
        if (repair.motive_driver_signed_date) {
          approvalDate = new Date(repair.motive_driver_signed_date).toLocaleString();
        }
      }

      // Build description (category + description + notes)
      let description = '';
      if (repair.repair_code_category) {
        description += escapeHtml(repair.repair_code_category) + '<br/>';
      }
      if (repair.repair_desc) {
        description += escapeHtml(repair.repair_desc) + '<br/>';
      }
      if (repair.notes) {
        description += '<span class="text-muted">' + escapeHtml(repair.notes).replace(/\n/g, '<br/>') + '</span>';
      }
      if (!description) description = 'N/A';

      const statusClass = (repair.rpor_status || '').toLowerCase().replace(/_/g, '');
      const typeClass = (repair.issue_type || '').toLowerCase();
      const sourceClass = (repair.defect_source || '').toLowerCase();

      repairRowsHtml += `
        <tr>
          <td class="text-center"><strong>${rowNumber++}</strong></td>
          <td><strong>#${escapeHtml(repair.vrlid)}</strong></td>
          <td>${description}</td>
          <td>${escapeHtml(reportedBy)}</td>
          <td><span class="badge badge-${typeClass}">${escapeHtml(repair.issue_type || 'N/A')}</span></td>
          <td><span class="badge badge-${statusClass}">${escapeHtml((repair.rpor_status || 'N/A').replace(/_/g, ' '))}</span></td>
          <td><span class="badge badge-${sourceClass}">${escapeHtml(repair.defect_source || 'N/A')}</span></td>
          <td>${escapeHtml(approvedBy)}</td>
          <td><span class="badge badge-${approvalStatus.toLowerCase()}">${escapeHtml(approvalStatus)}</span></td>
          <td class="text-muted-small">${escapeHtml(approvalDate)}</td>
        </tr>
      `;
    });
  }

  // Build scheduled maintenance line items HTML
  let maintenanceRowsHtml = '';
  if (roDetails.scheduled_maintenance && roDetails.scheduled_maintenance.length > 0) {
    roDetails.scheduled_maintenance.forEach(item => {
      const statusClass = (item.rpor_status || '').toLowerCase().replace(/_/g, '');
      
      maintenanceRowsHtml += `
        <tr>
          <td class="text-center"><strong>${rowNumber++}</strong></td>
          <td><strong>#${escapeHtml(item.id)}</strong></td>
          <td>${escapeHtml(item.setting_name || 'N/A')}</td>
          <td class="text-center"><span class="badge badge-scheduled">SCHEDULED</span></td>
          <td><span class="badge badge-${statusClass}">${escapeHtml((item.rpor_status || 'N/A').replace(/_/g, ' '))}</span></td>
          <td>${escapeHtml(item.service_completion_date || 'N/A')}</td>
          <td class="text-right">${item.current_kms ? escapeHtml(item.current_kms.toLocaleString()) : 'N/A'}</td>
        </tr>
      `;
    });
  }

  if (!repairRowsHtml && !maintenanceRowsHtml) {
    repairRowsHtml = '<tr><td colspan="10" class="text-center">No repair items found.</td></tr>';
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Repair Order #${escapeHtml(roDetails.rpoid)} - ${escapeHtml(roDetails.vehicle_nickname)}</title>
      <style>
        /* ========== RESET & BASE ========== */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #1f2937;
          background: #ffffff;
          padding: 30px;
        }

        /* ========== HEADER SECTION ========== */
        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 25px;
          margin-bottom: 25px;
          border-bottom: 4px solid #2563eb;
        }

        .company-section {
          flex: 1;
        }

        .company-logo {
          max-width: 180px;
          max-height: 70px;
          margin-bottom: 10px;
        }

        .company-name {
          font-size: 26px;
          font-weight: 700;
          color: #2563eb;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .company-tagline {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
        }

        .ro-section {
          text-align: right;
        }

        .document-title {
          font-size: 15px;
          font-weight: 600;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 8px;
        }

        .ro-number {
          font-size: 36px;
          font-weight: 800;
          color: #1f2937;
          line-height: 1;
          margin-bottom: 10px;
        }

        .ro-status {
          display: inline-block;
          padding: 6px 18px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ro-status.active { background: #fef3c7; color: #92400e; }
        .ro-status.inprogress { background: #dbeafe; color: #1e40af; }
        .ro-status.completed { background: #d1fae5; color: #065f46; }
        .ro-status.cancelled { background: #fee2e2; color: #991b1b; }

        /* ========== INFO GRID ========== */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }

        .info-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 18px;
        }

        .info-box-title {
          font-size: 12px;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 2px solid #dbeafe;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-weight: 600;
          color: #6b7280;
          font-size: 13px;
        }

        .info-value {
          color: #1f2937;
          font-size: 13px;
          text-align: right;
          font-weight: 500;
        }

        /* ========== SECTIONS ========== */
        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 30px 0 15px 0;
          padding-bottom: 8px;
          border-bottom: 3px solid #2563eb;
        }

        .notes-box {
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          border-radius: 6px;
          padding: 16px;
          margin: 20px 0;
        }

        .notes-title {
          font-weight: 700;
          color: #92400e;
          margin-bottom: 8px;
          font-size: 13px;
          text-transform: uppercase;
        }

        .notes-content {
          color: #78350f;
          font-size: 13px;
          line-height: 1.7;
        }

        /* ========== TABLES ========== */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .items-table thead th {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .items-table thead th.text-center {
          text-align: center;
        }

        .items-table thead th.text-right {
          text-align: right;
        }

        .items-table tbody td {
          padding: 12px 8px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .items-table tbody tr:nth-child(odd) {
          background: #ffffff;
        }

        .items-table tbody tr:nth-child(even) {
          background: #f9fafb;
        }

        .items-table tbody tr:hover {
          background: #f3f4f6;
        }

        .items-table .text-center {
          text-align: center;
        }

        .items-table .text-right {
          text-align: right;
        }

        .text-muted {
          color: #9ca3af;
          font-size: 11px;
        }

        .text-muted-small {
          color: #9ca3af;
          font-size: 10px;
        }

        /* ========== BADGES ========== */
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }

        /* Status Badges */
        .badge-open { background: #dbeafe; color: #1e40af; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-inprogress { background: #e0e7ff; color: #4338ca; }
        .badge-completed { background: #d1fae5; color: #065f46; }
        .badge-rejected { background: #fee2e2; color: #991b1b; }
        .badge-paused { background: #fef3c7; color: #92400e; }
        .badge-reopened { background: #fed7aa; color: #c2410c; }
        .badge-repairnotrequired { background: #d1fae5; color: #065f46; }
        .badge-rocancelled { background: #f3f4f6; color: #4b5563; }

        /* Type Badges */
        .badge-major { background: #fee2e2; color: #991b1b; }
        .badge-minor { background: #fef3c7; color: #92400e; }
        .badge-scheduled { background: #dbeafe; color: #1e40af; }
        .badge-scheduledmaintenance { background: #dbeafe; color: #1e40af; }

        /* Source Badges */
        .badge-skysoft { background: #e0e7ff; color: #4338ca; }
        .badge-motive { background: #fce7f3; color: #9f1239; }

        /* Approval Status Badges */
        .badge-approved { background: #d1fae5; color: #065f46; }

        /* ========== SUMMARY BOX ========== */
        .summary-box {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 2px solid #2563eb;
          border-radius: 10px;
          padding: 20px;
          margin: 30px 0;
        }

        .summary-title {
          font-size: 14px;
          font-weight: 700;
          color: #1f2937;
          text-transform: uppercase;
          margin-bottom: 15px;
          letter-spacing: 0.5px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }

        .summary-item {
          text-align: center;
          padding: 10px;
          background: white;
          border-radius: 6px;
          border: 1px solid #dbeafe;
        }

        .summary-item-value {
          font-size: 24px;
          font-weight: 800;
          color: #2563eb;
          margin-bottom: 4px;
        }

        .summary-item-label {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
        }

        /* ========== FOOTER ========== */
        .print-footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
        }

        .footer-info {
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.8;
        }

        .footer-timestamp {
          font-weight: 600;
          color: #6b7280;
        }

        /* ========== PRINT STYLES ========== */
        @media print {
          body {
            padding: 15px;
          }

          .page-break {
            page-break-before: always;
          }

          .items-table {
            page-break-inside: auto;
          }

          .items-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .items-table thead {
            display: table-header-group;
          }

          .summary-box {
            page-break-inside: avoid;
          }

          @page {
            margin: 1.5cm;
          }
        }
      </style>
    </head>
    <body>
      <!-- HEADER -->
      <div class="print-header">
        <div class="company-section">
          <div class="company-name">Skysoft Fleet Management</div>
          <div class="company-tagline">Enterprise Vehicle Maintenance System</div>
        </div>
        <div class="ro-section">
          <div class="document-title">Repair Purchase Order</div>
          <div class="ro-number">RO #${escapeHtml(roDetails.rpoid)}</div>
          <span class="ro-status ${currentStatus.toLowerCase().replace(' ', '')}">${escapeHtml(currentStatus)}</span>
        </div>
      </div>

      <!-- INFO GRID -->
      <div class="info-grid">
        <!-- Vehicle Information -->
        <div class="info-box">
          <div class="info-box-title">Vehicle Information</div>
          <div class="info-row">
            <span class="info-label">Vehicle Unit:</span>
            <span class="info-value">${escapeHtml(roDetails.vehicle_nickname || 'N/A')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Odometer Before:</span>
            <span class="info-value">${roDetails.kms_before_service ? escapeHtml(roDetails.kms_before_service.toLocaleString()) + ' km' : 'N/A'}</span>
          </div>
          ${roDetails.kms_after_service ? `
          <div class="info-row">
            <span class="info-label">Odometer After:</span>
            <span class="info-value">${escapeHtml(roDetails.kms_after_service.toLocaleString())} km</span>
          </div>
          ` : ''}
        </div>

        <!-- Service Information -->
        <div class="info-box">
          <div class="info-box-title">Service Information</div>
          <div class="info-row">
            <span class="info-label">Requested By:</span>
            <span class="info-value">${escapeHtml(roDetails.requested_by_name || 'N/A')}</span>
          </div>
          ${roDetails.service_completed_date ? `
          <div class="info-row">
            <span class="info-label">Completed Date:</span>
            <span class="info-value">${escapeHtml(roDetails.service_completed_date)}</span>
          </div>
          ` : ''}
        </div>

        <!-- Vendor Information -->
        <div class="info-box">
          <div class="info-box-title">Vendor Information</div>
          <div class="info-row">
            <span class="info-label">Vendor:</span>
            <span class="info-value">${escapeHtml(roDetails.vendor_name || 'N/A')}</span>
          </div>
          ${roDetails.vendor_phone ? `
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${escapeHtml(roDetails.vendor_phone)}</span>
          </div>
          ` : ''}
          ${roDetails.vendor_email ? `
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${escapeHtml(roDetails.vendor_email)}</span>
          </div>
          ` : ''}
        </div>

        <!-- Financial Information -->
        <div class="info-box">
          <div class="info-box-title">Financial Information</div>
          <div class="info-row">
            <span class="info-label">Estimated Amount:</span>
            <span class="info-value">$${(roDetails.estimated_repair_amount || 0).toFixed(2)}</span>
          </div>
          ${roDetails.invoice_amount ? `
          <div class="info-row">
            <span class="info-label">Invoice Amount:</span>
            <span class="info-value font-weight: 700;">$${roDetails.invoice_amount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${roDetails.payment_method_name ? `
          <div class="info-row">
            <span class="info-label">Payment Method:</span>
            <span class="info-value">${escapeHtml(roDetails.payment_method_name)}</span>
          </div>
          ` : ''}
          ${roDetails.work_order_number ? `
          <div class="info-row">
            <span class="info-label">Work Order #:</span>
            <span class="info-value">${escapeHtml(roDetails.work_order_number)}</span>
          </div>
          ` : ''}
          ${roDetails.invoice_number ? `
          <div class="info-row">
            <span class="info-label">Invoice #:</span>
            <span class="info-value">${escapeHtml(roDetails.invoice_number)}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- REPAIR NOTES -->
      ${roDetails.repair_notes ? `
      <div class="notes-box">
        <div class="notes-title">Internal Repair Notes</div>
        <div class="notes-content">${escapeHtml(roDetails.repair_notes).replace(/\n/g, '<br/>')}</div>
      </div>
      ` : ''}

      <!-- LINE ITEMS TABLE -->
      <div class="section-title">Line Items</div>
      <table class="items-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 4%;">#</th>
            <th class="text-center" style="width: 5%;">ID</th>
            <th style="width: 22%;">Description</th>
            <th style="width: 11%;">Reported By</th>
            <th style="width: 8%;">Type</th>
            <th style="width: 10%;">Status</th>
            <th style="width: 8%;">Source</th>
            <th style="width: 12%;">Approved/Signed By</th>
            <th style="width: 10%;">Approval Status</th>
            <th style="width: 10%;">Approval Date</th>
          </tr>
        </thead>
        <tbody>
          ${repairRowsHtml}
          ${maintenanceRowsHtml}
        </tbody>
      </table>

      <!-- SUMMARY BOX -->
      <div class="summary-box">
        <div class="summary-title">RO Summary</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-item-value">${roDetails.summary?.item_count || 0}</div>
            <div class="summary-item-label">Total Items</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-value">${roDetails.summary?.status_completed_count || 0}</div>
            <div class="summary-item-label">Completed</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-value">${roDetails.summary?.status_in_progress_count || 0}</div>
            <div class="summary-item-label">In Progress</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-value">${roDetails.summary?.status_open_count || 0}</div>
            <div class="summary-item-label">Open</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="print-footer">
        <div class="footer-info">
          <p class="footer-timestamp">Generated on: ${escapeHtml(currentDate)}</p>
          <p>Skysoft Fleet Management System | Enterprise Vehicle Maintenance Module</p>
          <p>This document is computer-generated and does not require a signature</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
