package com.shape.gymapp.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shape.gymapp.core.util.CurrencyFormatter
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.domain.model.PaymentMode
import com.shape.gymapp.domain.model.RenewalMemberItem
import com.shape.gymapp.ui.components.ShapePrimaryButton
import com.shape.gymapp.ui.components.ShapeTextField
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.AlertYellow
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RenewMembershipDialog(
    item: RenewalMemberItem,
    availablePlans: List<MembershipPlan>,
    isRenewing: Boolean,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onConfirm: (plan: MembershipPlan, amountPaid: Double, mode: PaymentMode, note: String?) -> Unit
) {
    var selectedPlan by remember {
        mutableStateOf(availablePlans.firstOrNull { it.id == item.planId } ?: availablePlans.firstOrNull())
    }

    val carryForward = item.pendingBalance
    val currentPlanFee = selectedPlan?.fee ?: 0.0
    val totalDue = currentPlanFee + carryForward

    var amountPaidStr by remember { mutableStateOf(totalDue.toInt().toString()) }
    var paymentMode by remember { mutableStateOf(PaymentMode.UPI) }
    var note by remember { mutableStateOf("") }

    val paid = amountPaidStr.toDoubleOrNull() ?: 0.0
    val newBalance = (totalDue - paid).coerceAtLeast(0.0)

    val today = DateUtils.todayIso()
    val newStart = if (item.daysRemaining > 0) item.expiryDateIso else today
    val newEnd = if (selectedPlan != null) DateUtils.addDays(newStart, selectedPlan!!.durationDays) else ""

    BasicAlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(GymSurfaceCard)
            .border(1.dp, GymBorder, RoundedCornerShape(24.dp))
            .padding(24.dp)
    ) {
        Column {
            Text(
                text = "Renew Membership",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            Text(
                text = "Member: ${item.name} (${item.phone})",
                fontSize = 13.sp,
                color = ShapeOrangePrimary,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 4.dp, bottom = 14.dp)
            )

            if (carryForward > 0) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AlertYellow.copy(alpha = 0.15f), RoundedCornerShape(10.dp))
                        .border(1.dp, AlertYellow.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                        .padding(10.dp)
                ) {
                    Text(
                        text = "⚠️ Previous balance of ${CurrencyFormatter.formatInr(carryForward)} will be carried forward to this renewal.",
                        color = AlertYellow,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                Spacer(modifier = Modifier.height(14.dp))
            }

            // Plan Selector
            Text("Select Renewal Plan:", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(8.dp))

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                availablePlans.forEach { plan ->
                    val isSelected = selectedPlan?.id == plan.id
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (isSelected) ShapeOrangePrimary.copy(alpha = 0.15f) else Color(0xFF1E222A))
                            .border(1.dp, if (isSelected) ShapeOrangePrimary else GymBorder, RoundedCornerShape(10.dp))
                            .clickable {
                                selectedPlan = plan
                                amountPaidStr = (plan.fee + carryForward).toInt().toString()
                            }
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(plan.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                            Text(CurrencyFormatter.formatInr(plan.fee), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ShapeOrangePrimary)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Renewal Dates Info
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Start: ${DateUtils.formatDisplay(newStart)}", fontSize = 11.sp, color = TextSecondary)
                Text("New Expiry: ${DateUtils.formatDisplay(newEnd)}", fontSize = 11.sp, color = AlertGreen, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Amount Paid & Payment Mode
            ShapeTextField(
                value = amountPaidStr,
                onValueChange = { amountPaidStr = it.filter { char -> char.isDigit() } },
                label = "Amount Paid Now (₹)",
                placeholder = totalDue.toInt().toString(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Payment Mode Selector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                PaymentMode.values().forEach { mode ->
                    val isSelected = paymentMode == mode
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSelected) ShapeOrangePrimary else Color(0xFF1E222A))
                            .clickable { paymentMode = mode }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(mode.display, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (isSelected) TextPrimary else TextSecondary)
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Summary
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1E222A), RoundedCornerShape(10.dp))
                    .padding(10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Total Due: ${CurrencyFormatter.formatInr(totalDue)}", fontSize = 12.sp, color = TextSecondary)
                Text(
                    "New Balance: ${CurrencyFormatter.formatInr(newBalance)}",
                    fontSize = 12.sp,
                    color = if (newBalance > 0) AlertRed else AlertGreen,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = TextSecondary)
                }

                Spacer(modifier = Modifier.width(12.dp))

                ShapePrimaryButton(
                    text = "Confirm Renewal",
                    onClick = {
                        if (selectedPlan != null) {
                            onConfirm(selectedPlan!!, paid, paymentMode, note.ifBlank { null })
                        }
                    },
                    isLoading = isRenewing,
                    modifier = Modifier.width(170.dp)
                )
            }
        }
    }
}
