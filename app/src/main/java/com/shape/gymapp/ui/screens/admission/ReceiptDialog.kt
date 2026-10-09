package com.shape.gymapp.ui.screens.admission

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.shape.gymapp.domain.model.AdmissionSuccessResult
import com.shape.gymapp.ui.components.ShapePrimaryButton
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptDialog(
    result: AdmissionSuccessResult,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    BasicAlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(GymSurfaceCard)
            .border(1.dp, GymBorder, RoundedCornerShape(24.dp))
            .padding(24.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .background(AlertGreen.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = AlertGreen,
                    modifier = Modifier.size(42.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Admission Successful!",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            Text(
                text = "${result.memberName} has been enrolled into Shape Gym with dual signatures & photo synced.",
                fontSize = 13.sp,
                color = TextSecondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp, bottom = 20.dp)
            )

            // PDF Receipt Card
            if (result.receiptPdfFile != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E222A), RoundedCornerShape(12.dp))
                        .border(1.dp, GymBorder, RoundedCornerShape(12.dp))
                        .padding(14.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.PictureAsPdf,
                            contentDescription = null,
                            tint = Color(0xFFE53935),
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Official Admission Receipt.pdf",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Ready to share with member",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // WhatsApp / Share Button
                OutlinedButton(
                    onClick = { shareReceiptPdf(context, result.receiptPdfFile, result.memberName) },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = "Share",
                        tint = AlertGreen,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Share Receipt via WhatsApp",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))
            }

            ShapePrimaryButton(
                text = "Done & Next Admission",
                onClick = onDismiss
            )
        }
    }
}

private fun shareReceiptPdf(context: Context, file: File, memberName: String) {
    try {
        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        val intent = Intent(Intent.ActionSend).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Shape Gym Admission Receipt - $memberName")
            putExtra(Intent.EXTRA_TEXT, "Hello $memberName, welcome to Shape Fitness Club! Here is your official admission receipt.")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val chooser = Intent.createChooser(intent, "Share Admission Receipt")
        context.startActivity(chooser)
    } catch (e: Exception) {
        e.printStackTrace()
    }
}
