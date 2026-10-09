package com.shape.gymapp.ui.screens.plans

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.ui.components.ShapePrimaryButton
import com.shape.gymapp.ui.components.ShapeTextField
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditPlanDialog(
    planToEdit: MembershipPlan?,
    onDismiss: () -> Unit,
    onSave: (name: String, durationDays: Int, fee: Double, description: String?, isActive: Boolean) -> Unit
) {
    var name by remember { mutableStateOf(planToEdit?.name ?: "") }
    var durationDaysStr by remember { mutableStateOf(planToEdit?.durationDays?.toString() ?: "90") }
    var feeStr by remember { mutableStateOf(planToEdit?.fee?.toInt()?.toString() ?: "4999") }
    var description by remember { mutableStateOf(planToEdit?.description ?: "") }
    var isActive by remember { mutableStateOf(planToEdit?.isActive ?: true) }

    var nameError by remember { mutableStateOf<String?>(null) }
    var durationError by remember { mutableStateOf<String?>(null) }
    var feeError by remember { mutableStateOf<String?>(null) }

    BasicAlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(GymSurfaceCard)
            .padding(24.dp)
    ) {
        Column {
            Text(
                text = if (planToEdit == null) "Create New Membership Plan" else "Edit Membership Plan",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            Text(
                text = "Past subscriptions are snapshot-protected and will never be modified.",
                fontSize = 12.sp,
                color = TextMuted,
                modifier = Modifier.padding(top = 4.dp, bottom = 16.dp)
            )

            // Plan Name
            ShapeTextField(
                value = name,
                onValueChange = { name = it; nameError = null },
                label = "Plan Name",
                placeholder = "e.g. 3 Months",
                errorMessage = nameError
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Duration in Days
            ShapeTextField(
                value = durationDaysStr,
                onValueChange = { durationDaysStr = it; durationError = null },
                label = "Duration (in Days)",
                placeholder = "90",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                errorMessage = durationError
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Fee in INR
            ShapeTextField(
                value = feeStr,
                onValueChange = { feeStr = it; feeError = null },
                label = "Fee in INR (₹)",
                placeholder = "4999",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                errorMessage = feeError
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Description
            ShapeTextField(
                value = description,
                onValueChange = { description = it },
                label = "Description (Optional)",
                placeholder = "Includes gym and all program access",
                singleLine = false
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Is Active Switch
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Plan Active for Admissions",
                    color = TextSecondary,
                    fontSize = 14.sp
                )
                Switch(
                    checked = isActive,
                    onCheckedChange = { isActive = it },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = TextPrimary,
                        checkedTrackColor = ShapeOrangePrimary
                    )
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

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
                    text = if (planToEdit == null) "Create Plan" else "Save Changes",
                    onClick = {
                        var hasError = false
                        if (name.isBlank()) {
                            nameError = "Plan name is required"
                            hasError = true
                        }
                        val days = durationDaysStr.toIntOrNull()
                        if (days == null || days <= 0) {
                            durationError = "Enter valid positive days"
                            hasError = true
                        }
                        val fee = feeStr.toDoubleOrNull()
                        if (fee == null || fee < 0) {
                            feeError = "Enter valid fee amount"
                            hasError = true
                        }

                        if (!hasError && days != null && fee != null) {
                            onSave(name.trim(), days, fee, description.trim().ifBlank { null }, isActive)
                        }
                    },
                    modifier = Modifier.width(160.dp)
                )
            }
        }
    }
}
