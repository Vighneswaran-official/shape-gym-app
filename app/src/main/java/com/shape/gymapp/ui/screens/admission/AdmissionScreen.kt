package com.shape.gymapp.ui.screens.admission

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Money
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.core.util.CurrencyFormatter
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.domain.model.BloodGroup
import com.shape.gymapp.domain.model.PaymentMode
import com.shape.gymapp.ui.components.MemberPhotoPicker
import com.shape.gymapp.ui.components.ShapePrimaryButton
import com.shape.gymapp.ui.components.ShapeTextField
import com.shape.gymapp.ui.components.SignaturePad
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.AlertYellow
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun AdmissionScreen(
    onNavigateBack: () -> Unit = {},
    viewModel: AdmissionViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    var bloodGroupExpanded by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = GymOnyxBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
                .verticalScroll(scrollState)
                .padding(20.dp)
        ) {
            // Header
            Text(
                text = "New Member Admission",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = TextPrimary
            )
            Text(
                text = "Register member, collect signatures, and generate admission receipt",
                fontSize = 13.sp,
                color = TextSecondary,
                modifier = Modifier.padding(top = 2.dp, bottom = 20.dp)
            )

            if (uiState.submitError != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AlertRed.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                        .border(1.dp, AlertRed.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        .padding(14.dp)
                ) {
                    Text(
                        text = uiState.submitError ?: "",
                        color = AlertRed,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // ==========================================
            // SECTION 1: PERSONAL & CONTACT DETAILS
            // ==========================================
            SectionTitle("1. Personal & Contact Information", Icons.Default.Person)

            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, GymBorder, RoundedCornerShape(16.dp)),
                colors = CardDefaults.cardColors(containerColor = GymSurfaceCard),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Full Name
                    ShapeTextField(
                        value = uiState.fullName,
                        onValueChange = viewModel::onFullNameChange,
                        label = "Full Name *",
                        placeholder = "e.g. Ramesh Kumar",
                        errorMessage = uiState.fullNameError
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Phone Number
                    ShapeTextField(
                        value = uiState.phone,
                        onValueChange = viewModel::onPhoneChange,
                        label = "Mobile Phone (10 Digits) *",
                        placeholder = "9876543210",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        leadingIcon = Icons.Default.Phone,
                        errorMessage = uiState.phoneError
                    )

                    if (uiState.phoneDuplicateWarning) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = AlertYellow, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Notice: This phone number is already registered in the gym database.",
                                color = AlertYellow,
                                fontSize = 11.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Photo Picker
                    MemberPhotoPicker(onPhotoSelected = viewModel::onPhotoSelected)

                    Spacer(modifier = Modifier.height(12.dp))

                    // Aadhaar (12 digits, validated, client encrypted)
                    ShapeTextField(
                        value = uiState.aadhaarRaw,
                        onValueChange = viewModel::onAadhaarChange,
                        label = "Aadhaar Number (12 Digits)",
                        placeholder = "123456789012",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        errorMessage = uiState.aadhaarError
                    )

                    if (uiState.aadhaarRaw.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Security, contentDescription = null, tint = AlertGreen, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            val masked = if (uiState.aadhaarRaw.length >= 4) "XXXX-XXXX-${uiState.aadhaarRaw.takeLast(4)}" else "XXXX-XXXX-XXXX"
                            Text(
                                text = "Display Mask: $masked (AES-256 Encrypted on Device)",
                                color = AlertGreen,
                                fontSize = 11.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Age
                        ShapeTextField(
                            value = uiState.age,
                            onValueChange = viewModel::onAgeChange,
                            label = "Age *",
                            placeholder = "25",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            errorMessage = uiState.ageError,
                            modifier = Modifier.weight(1f)
                        )

                        // Blood Group Dropdown
                        ExposedDropdownMenuBox(
                            expanded = bloodGroupExpanded,
                            onExpandedChange = { bloodGroupExpanded = !bloodGroupExpanded },
                            modifier = Modifier.weight(1f)
                        ) {
                            OutlinedTextField(
                                value = uiState.bloodGroup?.display ?: "Select",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Blood Group", color = TextSecondary) },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = bloodGroupExpanded) },
                                shape = RoundedCornerShape(12.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = GymSurfaceCard,
                                    unfocusedContainerColor = GymSurfaceCard,
                                    focusedBorderColor = ShapeOrangePrimary,
                                    unfocusedBorderColor = GymBorder,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                ),
                                modifier = Modifier.menuAnchor()
                            )

                            ExposedDropdownMenu(
                                expanded = bloodGroupExpanded,
                                onDismissRequest = { bloodGroupExpanded = false },
                                modifier = Modifier.background(GymSurfaceCard)
                            ) {
                                BloodGroup.values().forEach { bg ->
                                    DropdownMenuItem(
                                        text = { Text(bg.display, color = TextPrimary) },
                                        onClick = {
                                            viewModel.onBloodGroupChange(bg)
                                            bloodGroupExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Address
                    ShapeTextField(
                        value = uiState.address,
                        onValueChange = viewModel::onAddressChange,
                        label = "Address",
                        placeholder = "Area, Street, City",
                        singleLine = false
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Health History (AES-256 Encrypted on Device)
                    ShapeTextField(
                        value = uiState.healthHistory,
                        onValueChange = viewModel::onHealthHistoryChange,
                        label = "Health History / Medical Conditions",
                        placeholder = "Any injuries, heart condition, asthma, or medications (AES-256 Encrypted)",
                        singleLine = false
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ==========================================
            // SECTION 2: PROGRAMS & MEMBERSHIP PLAN
            // ==========================================
            SectionTitle("2. Gym Programs & Membership Plan", Icons.Default.FitnessCenter)

            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, GymBorder, RoundedCornerShape(16.dp)),
                colors = CardDefaults.cardColors(containerColor = GymSurfaceCard),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Select Program(s):",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Program Multi-Select Chips
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        uiState.availablePrograms.forEach { prog ->
                            val selected = uiState.selectedProgramIds.contains(prog.id)
                            FilterChip(
                                selected = selected,
                                onClick = { viewModel.toggleProgram(prog.id) },
                                label = { Text(prog.name, fontSize = 12.sp, color = if (selected) TextPrimary else TextSecondary) },
                                leadingIcon = if (selected) {
                                    { Icon(Icons.Default.Check, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(14.dp)) }
                                } else null,
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = ShapeOrangePrimary,
                                    selectedLabelColor = TextPrimary
                                )
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Membership Plan:",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Plan Selection Cards
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        uiState.availablePlans.forEach { plan ->
                            val isSelected = uiState.selectedPlan?.id == plan.id
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isSelected) ShapeOrangePrimary.copy(alpha = 0.12f) else Color(0xFF1E222A))
                                    .border(
                                        1.5.dp,
                                        if (isSelected) ShapeOrangePrimary else GymBorder,
                                        RoundedCornerShape(12.dp)
                                    )
                                    .clickable { viewModel.onPlanSelected(plan) }
                                    .padding(14.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(
                                            text = plan.name,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "${plan.durationDays} Days Duration",
                                            fontSize = 11.sp,
                                            color = TextSecondary
                                        )
                                    }

                                    Text(
                                        text = CurrencyFormatter.formatInr(plan.fee),
                                        fontWeight = FontWeight.Black,
                                        fontSize = 17.sp,
                                        color = if (isSelected) ShapeOrangePrimary else TextPrimary
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Dates Display
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Joining: ${DateUtils.formatDisplay(uiState.joiningDateIso)}",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                        Text(
                            text = "Expiry Date: ${DateUtils.formatDisplay(uiState.expiryDateIso)}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = AlertGreen
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ==========================================
            // SECTION 3: FEES & PAYMENT
            // ==========================================
            SectionTitle("3. Fee Collection & Payment Mode", Icons.Default.Money)

            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, GymBorder, RoundedCornerShape(16.dp)),
                colors = CardDefaults.cardColors(containerColor = GymSurfaceCard),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ShapeTextField(
                            value = uiState.admissionFeeStr,
                            onValueChange = viewModel::onAdmissionFeeChange,
                            label = "Admission Fee (₹)",
                            placeholder = "0",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f)
                        )

                        ShapeTextField(
                            value = uiState.amountPaidStr,
                            onValueChange = viewModel::onAmountPaidChange,
                            label = "Amount Paid (₹) *",
                            placeholder = uiState.totalFeeDue.toInt().toString(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Payment Mode Radio Buttons
                    Text(
                        text = "Payment Mode:",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        PaymentMode.values().forEach { mode ->
                            val isSelected = uiState.paymentMode == mode
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) ShapeOrangePrimary else Color(0xFF1E222A))
                                    .clickable { viewModel.onPaymentModeChange(mode) }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = mode.display,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) TextPrimary else TextSecondary
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Summary Banner
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1E222A), RoundedCornerShape(10.dp))
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Total Due", fontSize = 11.sp, color = TextSecondary)
                            Text(CurrencyFormatter.formatInr(uiState.totalFeeDue), fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("Pending Balance", fontSize = 11.sp, color = TextSecondary)
                            Text(
                                text = CurrencyFormatter.formatInr(uiState.balancePending),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (uiState.balancePending > 0) AlertRed else AlertGreen
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ==========================================
            // SECTION 4: DPDP ACT CONSENT
            // ==========================================
            SectionTitle("4. Data Privacy & Consent", Icons.Default.Security)

            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, GymBorder, RoundedCornerShape(16.dp)),
                colors = CardDefaults.cardColors(containerColor = GymSurfaceCard),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = uiState.consentGiven,
                            onCheckedChange = viewModel::onConsentChange,
                            colors = CheckboxDefaults.colors(
                                checkedColor = ShapeOrangePrimary,
                                uncheckedColor = GymBorder
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "I hereby confirm consent to store and process the member's personal fitness and identification details in accordance with India's Digital Personal Data Protection (DPDP) Act 2023.",
                            fontSize = 12.sp,
                            lineHeight = 17.sp,
                            color = TextPrimary
                        )
                    }

                    if (uiState.consentError != null) {
                        Text(
                            text = uiState.consentError ?: "",
                            color = AlertRed,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(start = 12.dp, top = 4.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ==========================================
            // SECTION 5: DUAL SIGNATURE PADS
            // ==========================================
            SectionTitle("5. Finger-Drawn Signatures (Mandatory)", Icons.Default.Security)

            if (uiState.signatureError != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AlertRed.copy(alpha = 0.15f), RoundedCornerShape(10.dp))
                        .padding(10.dp)
                ) {
                    Text(text = uiState.signatureError ?: "", color = AlertRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            // Client Signature Pad
            SignaturePad(
                title = "Client / Member Signature *",
                onSignatureChanged = viewModel::onClientSignatureChanged
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Manager Signature Pad
            SignaturePad(
                title = "Manager / Authorized Front-Desk Signature *",
                onSignatureChanged = viewModel::onManagerSignatureChanged
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Submit Button
            ShapePrimaryButton(
                text = "Complete Admission & Generate Receipt",
                onClick = viewModel::submitAdmission,
                isLoading = uiState.isSubmitting
            )

            Spacer(modifier = Modifier.height(30.dp))
        }

        // Admission Receipt Success Modal
        if (uiState.successResult != null) {
            ReceiptDialog(
                result = uiState.successResult!!,
                onDismiss = viewModel::dismissSuccessDialog
            )
        }
    }
}

@Composable
private fun SectionTitle(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(bottom = 10.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = ShapeOrangePrimary,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = title,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )
    }
}
