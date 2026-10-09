import { jsPDF } from 'jspdf';
import { formatInr, maskAadhaar } from './crypto.js';

export function generateReceiptPdf({
  memberName,
  phone,
  rawAadhaar,
  age,
  bloodGroup,
  address,
  planName,
  planDurationDays,
  joiningDate,
  expiryDate,
  programs,
  admissionFee,
  planFee,
  amountPaid,
  paymentMode,
  clientSigDataUrl,
  managerSigDataUrl,
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const receiptNo = `SHAPE-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // 1. Header Banner
  doc.setFillColor(255, 102, 0); // Shape Athletic Orange
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SHAPE FITNESS CLUB', 15, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('OFFICIAL MEMBERSHIP ADMISSION RECEIPT', 15, 21);
  doc.text('Indiranagar, Bengaluru | Phone: +91 98765 43210', 15, 26);

  // Receipt Meta (Right)
  doc.setFontSize(8);
  doc.text(`Receipt No: ${receiptNo}`, 195, 14, { align: 'right' });
  doc.text(`Date: ${dateStr}`, 195, 20, { align: 'right' });

  // 2. Member Profile Box
  let y = 42;
  doc.setDrawColor(220, 224, 230);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 180, 36, 3, 3, 'FD');

  doc.setTextColor(26, 32, 44);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MEMBER PROFILE', 20, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(74, 85, 104);

  // Row 1
  doc.text(`Name: ${memberName}`, 20, y + 16);
  doc.text(`Mobile: +91 ${phone}`, 105, y + 16);

  // Row 2
  doc.text(`Aadhaar: ${maskAadhaar(rawAadhaar)}`, 20, y + 23);
  doc.text(`Age / Blood: ${age} Yrs / ${bloodGroup || 'N/A'}`, 105, y + 23);

  // Row 3
  doc.text(`Address: ${address ? address.substring(0, 48) : 'Not Provided'}`, 20, y + 30);

  // 3. Subscription & Program Enrolment Box
  y = 86;
  doc.roundedRect(15, y, 180, 48, 3, 3, 'FD');

  doc.setTextColor(26, 32, 44);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MEMBERSHIP ENROLMENT & SCHEDULE', 20, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(74, 85, 104);

  doc.text(`Primary Plan: ${planName} (${planDurationDays} Days)`, 20, y + 17);
  doc.text(`Enrolled Programs: ${programs && programs.length ? programs.join(', ') : 'General Fitness'}`, 20, y + 24);
  doc.text(`Joining Date: ${joiningDate ? new Date(joiningDate).toLocaleDateString('en-IN') : dateStr}`, 20, y + 31);
  doc.text(`Validity Expiry Date: ${expiryDate ? new Date(expiryDate).toLocaleDateString('en-IN') : 'N/A'}`, 20, y + 38);

  // 4. Financial Summary Table
  y = 142;
  doc.setFillColor(255, 102, 0);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('DESCRIPTION', 20, y + 5.5);
  doc.text('AMOUNT (INR)', 190, y + 5.5, { align: 'right' });

  // Rows
  const totalDue = Number(admissionFee || 0) + Number(planFee || 0);
  const paid = Number(amountPaid || 0);
  const balance = totalDue - paid;

  const financialItems = [
    { label: 'One-Time Admission & Registration Fee', val: admissionFee },
    { label: `Membership Subscription Fee (${planName})`, val: planFee },
    { label: 'Total Enrolment Charges Due', val: totalDue, bold: true },
    { label: `Amount Paid via ${String(paymentMode).toUpperCase()}`, val: paid, bold: true, color: [22, 163, 74] },
    { label: 'Remaining Balance Payable', val: balance, bold: true, color: balance > 0 ? [220, 38, 38] : [22, 163, 74] },
  ];

  let curY = y + 8;
  financialItems.forEach((item, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(15, curY, 180, 7.5, 'F');
    doc.setDrawColor(230, 235, 240);
    doc.line(15, curY + 7.5, 195, curY + 7.5);

    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    if (item.color) {
      doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    } else {
      doc.setTextColor(ItemColor(item.bold));
    }
    doc.setFontSize(9);
    doc.text(item.label, 20, curY + 5.2);
    doc.text(formatInr(item.val), 190, curY + 5.2, { align: 'right' });

    curY += 7.5;
  });

  function ItemColor(bold) {
    return bold ? 26 : 74;
  }

  // 5. Dual Signatures Area (Side by Side)
  y = 205;
  doc.setTextColor(26, 32, 44);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AUTHORIZED SIGNATURES & VERIFICATION', 15, y);

  // Client signature box
  doc.setDrawColor(200, 205, 215);
  doc.setFillColor(255, 255, 255);
  doc.rect(15, y + 4, 85, 30, 'FD');
  if (clientSigDataUrl) {
    try {
      doc.addImage(clientSigDataUrl, 'PNG', 17, y + 5, 81, 28);
    } catch (e) {
      console.warn('Could not add client sig image:', e);
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 125);
  doc.text('Member / Client Signature', 15, y + 38);

  // Manager signature box
  doc.rect(110, y + 4, 85, 30, 'FD');
  if (managerSigDataUrl) {
    try {
      doc.addImage(managerSigDataUrl, 'PNG', 112, y + 5, 81, 28);
    } catch (e) {
      console.warn('Could not add manager sig image:', e);
    }
  }
  doc.text('Club Manager / Authorized Stamp', 110, y + 38);

  // 6. Terms & Footer
  y = 258;
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 140);
  doc.text(
    'Terms: Membership is non-transferable. Fees paid are non-refundable. Locker keys must be returned daily.',
    15,
    y
  );
  doc.text(
    'This is an electronically generated official receipt secured by Shape Gym Management System.',
    15,
    y + 4
  );

  doc.save(`ShapeGym_Receipt_${memberName.replace(/\s+/g, '_')}_${receiptNo}.pdf`);
}
