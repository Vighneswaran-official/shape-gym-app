package com.shape.gymapp.ui.screens.plans

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CardMembership
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.core.util.CurrencyFormatter
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.GymSurfaceDark
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary

@Composable
fun PlansScreen(
    onNavigateBack: () -> Unit = {},
    viewModel: PlansViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = GymOnyxBackground,
        floatingActionButton = {
            FloatingActionButton(
                onClick = viewModel::openAddPlan,
                containerColor = ShapeOrangePrimary,
                contentColor = TextPrimary,
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add Plan")
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Add Plan", fontWeight = FontWeight.Bold)
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(20.dp)
        ) {
            // Screen Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Membership Plans",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black,
                        color = TextPrimary
                    )
                    Text(
                        text = "Configured plans and subscription rates",
                        fontSize = 13.sp,
                        color = TextSecondary
                    )
                }

                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = ShapeOrangePrimary,
                        strokeWidth = 2.dp
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Info note
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1E222A), RoundedCornerShape(12.dp))
                    .border(1.dp, GymBorder, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Text(
                    text = "💡 Subscriptions store an immutable fee snapshot on admission. Editing a plan fee will only apply to future admissions and renewals.",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    lineHeight = 17.sp
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (uiState.plans.isEmpty() && !uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No plans configured yet", color = TextMuted)
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(uiState.plans, key = { it.id }) { plan ->
                        PlanCard(
                            plan = plan,
                            onEdit = { viewModel.openEditPlan(plan) },
                            onToggleActive = { viewModel.togglePlanActive(plan) },
                            onDelete = { viewModel.deletePlan(plan.id) }
                        )
                    }
                }
            }
        }

        if (uiState.isAddEditOpen) {
            AddEditPlanDialog(
                planToEdit = uiState.selectedPlanToEdit,
                onDismiss = viewModel::closeAddEditDialog,
                onSave = viewModel::savePlan
            )
        }
    }
}

@Composable
private fun PlanCard(
    plan: MembershipPlan,
    onEdit: () -> Unit,
    onToggleActive: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, GymBorder, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = GymSurfaceCard),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .background(ShapeOrangePrimary.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CardMembership,
                            contentDescription = null,
                            tint = ShapeOrangePrimary,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        Text(
                            text = plan.name,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "${plan.durationDays} Days Duration",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                    }
                }

                // Fee formatted as ₹4,999
                Text(
                    text = CurrencyFormatter.formatInr(plan.fee),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    color = ShapeOrangePrimary
                )
            }

            if (!plan.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = plan.description,
                    fontSize = 12.sp,
                    color = TextMuted,
                    lineHeight = 16.sp
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Footer: Active switch & Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(
                        checked = plan.isActive,
                        onCheckedChange = { onToggleActive() },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = TextPrimary,
                            checkedTrackColor = AlertGreen
                        ),
                        modifier = Modifier.padding(end = 8.dp)
                    )
                    Text(
                        text = if (plan.isActive) "Active" else "Deactivated",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (plan.isActive) AlertGreen else TextMuted
                    )
                }

                Row {
                    IconButton(onClick = onEdit) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Edit",
                            tint = TextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    IconButton(onClick = onDelete) {
                        Icon(
                            imageVector = Icons.Default.DeleteOutline,
                            contentDescription = "Delete",
                            tint = AlertRed.copy(alpha = 0.8f),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}
