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

  doc.setTextColor(255, 87, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MEMBER PROFILE', 20, y + 7);

  doc.setTextColor(40, 44, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Full Name: ${memberName}`, 20, y + 15);
  doc.text(`Mobile: +91 ${phone}`, 20, y + 22);
  doc.text(`Aadhaar: ${maskAadhaar(rawAadhaar)}`, 20, y + 29);

  doc.text(`Age: ${age} years`, 110, y + 15);
  doc.text(`Blood Group: ${bloodGroup || 'N/A'}`, 110, y + 22);
  doc.text(`Address: ${address || 'Bengaluru'}`, 110, y + 29);

  // 3. Subscription & Programs Box
  y += 42;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 180, 32, 3, 3, 'FD');

  doc.setTextColor(255, 87, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MEMBERSHIP & PROGRAM ENROLLMENT', 20, y + 7);

  doc.setTextColor(40, 44, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Selected Plan: ${planName} (${planDurationDays} Days)`, 20, y + 15);
  doc.text(`Valid From: ${joiningDate}`, 20, y + 22);
  doc.text(`Valid Till (Expiry): ${expiryDate}`, 20, y + 29);

  const progNames = programs && programs.length ? programs.join(', ') : 'All Gym Programs';
  doc.text(`Programs: ${progNames}`, 110, y + 15);
  doc.text(`Payment Mode: ${paymentMode}`, 110, y + 22);
  doc.text(`Status: Active Member`, 110, y + 29);

  // 4. Financial Table
  y += 38;
  doc.setFillColor(235, 238, 242);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(20, 24, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', 20, y + 5.5);
  doc.text('Amount (INR)', 190, y + 5.5, { align: 'right' });

  y += 10;
  const drawRow = (desc, amt, bold = false, color = [40, 44, 52]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(desc, 20, y + 4);
    doc.text(formatInr(amt), 190, y + 4, { align: 'right' });
    doc.setDrawColor(240, 242, 245);
    doc.line(15, y + 6, 195, y + 6);
    y += 8;
  };

  const admFee = Number(admissionFee) || 0;
  const subFee = Number(planFee) || 0;
  const totalDue = admFee + subFee;
  const paid = Number(amountPaid) || 0;
  const balance = Math.max(0, totalDue - paid);

  drawRow(`Membership Fee (${planName})`, subFee);
  if (admFee > 0) {
    drawRow('One-Time Admission Fee', admFee);
  }
  drawRow('Total Amount Due', totalDue, true);
  drawRow(`Amount Received (${paymentMode})`, paid, true, [46, 125, 50]);
  drawRow('Balance Pending', balance, true, balance > 0 ? [211, 47, 47] : [40, 44, 52]);

  // 5. Consent Note
  y += 4;
  doc.setTextColor(100, 110, 125);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'Consent Notice: Personal fitness and identity details are processed strictly per the India Digital Personal Data Protection (DPDP) Act 2023.',
    15,
    y
  );
  doc.text('Memberships are non-transferable and subject to gym operating policies.', 15, y + 4);

  // 6. Dual Signatures Section
  y += 14;
  doc.setDrawColor(200, 205, 215);
  doc.line(15, y, 195, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 44, 52);
  doc.text('MEMBER SIGNATURE', 30, y);
  doc.text('MANAGER / AUTHORIZED SIGNATURE', 125, y);

  y += 2;
  if (clientSigDataUrl) {
    try {
      doc.addImage(clientSigDataUrl, 'PNG', 25, y, 45, 18);
    } catch (e) {}
  }

  if (managerSigDataUrl) {
    try {
      doc.addImage(managerSigDataUrl, 'PNG', 125, y, 45, 18);
    } catch (e) {}
  }

  // Footer note
  doc.setTextColor(140, 150, 160);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Electronically generated by Shape Gym Management System', 105, 285, { align: 'center' });

  return doc;
}
