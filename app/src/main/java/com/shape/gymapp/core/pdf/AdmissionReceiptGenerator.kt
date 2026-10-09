package com.shape.gymapp.core.pdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import com.shape.gymapp.core.util.CurrencyFormatter
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.domain.model.AdmissionSubmission
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AdmissionReceiptGenerator @Inject constructor(
    @ApplicationContext private val context: Context
) {

    fun generateReceiptPdf(
        submission: AdmissionSubmission,
        memberId: String,
        receiptNumber: String = "SHAPE-${System.currentTimeMillis() % 1000000}"
    ): File? {
        return try {
            val pdfDocument = PdfDocument()
            val pageWidth = 595 // Standard A4 width in PostScript points
            val pageHeight = 842 // Standard A4 height in PostScript points
            val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create()
            val page = pdfDocument.startPage(pageInfo)
            val canvas: Canvas = page.canvas

            val paint = Paint()

            // 1. Background
            paint.color = Color.WHITE
            canvas.drawRect(0f, 0f, pageWidth.toFloat(), pageHeight.toFloat(), paint)

            // 2. Header Banner (Gym Flame Orange Accent)
            paint.color = Color.rgb(255, 87, 34) // #FF5722
            canvas.drawRect(0f, 0f, pageWidth.toFloat(), 110f, paint)

            // Header Title
            paint.color = Color.WHITE
            paint.isFakeBoldText = true
            paint.textSize = 28f
            canvas.drawText("SHAPE FITNESS CLUB", 40f, 50f, paint)

            paint.isFakeBoldText = false
            paint.textSize = 12f
            canvas.drawText("OFFICIAL MEMBERSHIP ADMISSION RECEIPT", 40f, 75f, paint)
            canvas.drawText("Phone: +91 98765 43210 | Email: support@shapegym.com", 40f, 93f, paint)

            // 3. Receipt Info Box (Right Side)
            val todayStr = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.US).format(Date())
            paint.color = Color.rgb(33, 33, 33)
            paint.textSize = 10f
            paint.textAlign = Paint.Align.RIGHT
            canvas.drawText("Receipt No: $receiptNumber", (pageWidth - 40).toFloat(), 50f, paint)
            canvas.drawText("Date: $todayStr", (pageWidth - 40).toFloat(), 68f, paint)
            paint.textAlign = Paint.Align.LEFT

            var y = 145f

            // 4. Section: Member Information
            paint.color = Color.rgb(220, 220, 220)
            canvas.drawRoundRect(RectF(40f, y, (pageWidth - 40).toFloat(), y + 115f), 8f, 8f, paint)
            paint.color = Color.WHITE
            canvas.drawRoundRect(RectF(41f, y + 1, (pageWidth - 41).toFloat(), y + 114f), 7f, 7f, paint)

            paint.color = Color.rgb(255, 87, 34)
            paint.isFakeBoldText = true
            paint.textSize = 13f
            canvas.drawText("MEMBER PROFILE", 55f, y + 25f, paint)

            paint.color = Color.rgb(60, 60, 60)
            paint.isFakeBoldText = false
            paint.textSize = 11f

            val maskedAadhaar = if (submission.rawAadhaar.length >= 4) {
                "XXXX-XXXX-${submission.rawAadhaar.takeLast(4)}"
            } else "XXXX-XXXX-XXXX"

            canvas.drawText("Full Name: ${submission.fullName}", 55f, y + 48f, paint)
            canvas.drawText("Phone Number: +91 ${submission.phone}", 55f, y + 68f, paint)
            canvas.drawText("Aadhaar Number: $maskedAadhaar", 55f, y + 88f, paint)

            canvas.drawText("Age: ${submission.age} yrs", 330f, y + 48f, paint)
            canvas.drawText("Blood Group: ${submission.bloodGroup?.display ?: "N/A"}", 330f, y + 68f, paint)
            canvas.drawText("Address: ${submission.address.ifBlank { "Not provided" }}", 330f, y + 88f, paint)

            y += 135f

            // 5. Section: Subscription & Program Details
            paint.color = Color.rgb(220, 220, 220)
            canvas.drawRoundRect(RectF(40f, y, (pageWidth - 40).toFloat(), y + 110f), 8f, 8f, paint)
            paint.color = Color.WHITE
            canvas.drawRoundRect(RectF(41f, y + 1, (pageWidth - 41).toFloat(), y + 109f), 7f, 7f, paint)

            paint.color = Color.rgb(255, 87, 34)
            paint.isFakeBoldText = true
            paint.textSize = 13f
            canvas.drawText("MEMBERSHIP & PROGRAM ENROLLMENT", 55f, y + 25f, paint)

            paint.color = Color.rgb(60, 60, 60)
            paint.isFakeBoldText = false
            paint.textSize = 11f
            canvas.drawText("Plan Selected: ${submission.selectedPlan.name} (${submission.selectedPlan.durationDays} Days)", 55f, y + 50f, paint)
            canvas.drawText("Valid From: ${DateUtils.formatDisplay(submission.joiningDateIso)}", 55f, y + 72f, paint)
            canvas.drawText("Valid Till (Expiry): ${DateUtils.formatDisplay(submission.expiryDateIso)}", 55f, y + 92f, paint)

            canvas.drawText("Programs Selected: ${submission.selectedProgramIds.size} Enrolled", 330f, y + 50f, paint)
            canvas.drawText("Payment Mode: ${submission.paymentMode.display}", 330f, y + 72f, paint)
            canvas.drawText("Status: Active Admission", 330f, y + 92f, paint)

            y += 130f

            // 6. Section: Financial Breakdown Table
            paint.color = Color.rgb(240, 240, 240)
            canvas.drawRect(40f, y, (pageWidth - 40).toFloat(), y + 28f, paint)
            paint.color = Color.BLACK
            paint.isFakeBoldText = true
            paint.textSize = 11f
            canvas.drawText("Description", 55f, y + 18f, paint)
            paint.textAlign = Paint.Align.RIGHT
            canvas.drawText("Amount (INR)", (pageWidth - 55).toFloat(), y + 18f, paint)
            paint.textAlign = Paint.Align.LEFT

            y += 32f

            val totalFee = submission.selectedPlan.fee + submission.admissionFee
            val balancePending = totalFee - submission.amountPaid

            fun drawTableRow(label: String, amount: Double, isBold: Boolean = false, color: Int = Color.rgb(40, 40, 40)) {
                paint.color = color
                paint.isFakeBoldText = isBold
                paint.textSize = 11f
                canvas.drawText(label, 55f, y + 16f, paint)
                paint.textAlign = Paint.Align.RIGHT
                canvas.drawText(CurrencyFormatter.formatInr(amount), (pageWidth - 55).toFloat(), y + 16f, paint)
                paint.textAlign = Paint.Align.LEFT

                paint.color = Color.rgb(235, 235, 235)
                canvas.drawLine(40f, y + 24f, (pageWidth - 40).toFloat(), y + 24f, paint)
                y += 28f
            }

            drawTableRow("Membership Subscription Fee (${submission.selectedPlan.name})", submission.selectedPlan.fee)
            if (submission.admissionFee > 0) {
                drawTableRow("One-Time Admission Fee", submission.admissionFee)
            }
            drawTableRow("Total Amount Due", totalFee, isBold = true)
            drawTableRow("Amount Received (${submission.paymentMode.display})", submission.amountPaid, isBold = true, color = Color.rgb(46, 125, 50))
            drawTableRow("Balance Pending", balancePending, isBold = true, color = if (balancePending > 0) Color.rgb(198, 40, 40) else Color.rgb(60, 60, 60))

            y += 15f

            // 7. Consent Notice (India DPDP Act)
            paint.color = Color.rgb(120, 120, 120)
            paint.isFakeBoldText = false
            paint.textSize = 9f
            canvas.drawText(
                "Consent: Member has authorized the storage of personal fitness and contact details as per India DPDP Act 2023.",
                40f,
                y,
                paint
            )
            canvas.drawText(
                "Gym memberships are non-transferable and subject to gym operating terms.",
                40f,
                y + 14f,
                paint
            )

            y += 40f

            // 8. Signatures Section (Dual Signatures: Client & Manager)
            paint.color = Color.rgb(220, 220, 220)
            canvas.drawLine(40f, y, (pageWidth - 40).toFloat(), y, paint)

            y += 15f
            paint.color = Color.rgb(50, 50, 50)
            paint.isFakeBoldText = true
            paint.textSize = 11f
            canvas.drawText("MEMBER SIGNATURE", 80f, y, paint)
            canvas.drawText("MANAGER / AUTHORIZED SIGNATURE", 340f, y, paint)

            y += 8f

            // Render Client Signature Bitmap if present
            if (submission.clientSignatureBytes.isNotEmpty()) {
                val clientBitmap = BitmapFactory.decodeByteArray(submission.clientSignatureBytes, 0, submission.clientSignatureBytes.size)
                if (clientBitmap != null) {
                    val destRect = RectF(60f, y, 220f, y + 60f)
                    canvas.drawBitmap(clientBitmap, null, destRect, null)
                }
            }

            // Render Manager Signature Bitmap if present
            if (submission.managerSignatureBytes.isNotEmpty()) {
                val mgrBitmap = BitmapFactory.decodeByteArray(submission.managerSignatureBytes, 0, submission.managerSignatureBytes.size)
                if (mgrBitmap != null) {
                    val destRect = RectF(340f, y, 500f, y + 60f)
                    canvas.drawBitmap(mgrBitmap, null, destRect, null)
                }
            }

            y += 70f
            paint.color = Color.rgb(150, 150, 150)
            paint.isFakeBoldText = false
            paint.textSize = 8f
            paint.textAlign = Paint.Align.CENTER
            canvas.drawText("Generated electronically by Shape Gym System • Valid without physical seal", pageWidth / 2f, y, paint)

            pdfDocument.finishPage(page)

            // Save to application cache dir
            val receiptsDir = File(context.cacheDir, "receipts").apply { mkdirs() }
            val cleanName = submission.fullName.replace("[^a-zA-Z0-9]".toRegex(), "_")
            val outputFile = File(receiptsDir, "Receipt_${cleanName}_$receiptNumber.pdf")

            val outputStream = FileOutputStream(outputFile)
            pdfDocument.writeTo(outputStream)
            outputStream.flush()
            outputStream.close()
            pdfDocument.close()

            outputFile
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
