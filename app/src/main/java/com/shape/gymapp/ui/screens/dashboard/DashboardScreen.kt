package com.shape.gymapp.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Autorenew
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CurrencyRupee
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.HourglassBottom
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.core.util.CurrencyFormatter
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.core.util.ExpiryAlertStatus
import com.shape.gymapp.domain.model.RenewalMemberItem
import com.shape.gymapp.ui.components.ExpiryAlertBadge
import com.shape.gymapp.ui.theme.AlertExpiredCardBg
import com.shape.gymapp.ui.theme.AlertExpiredDark
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.AlertYellow
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.ShapeRedAccent
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary

@Composable
fun DashboardScreen(
    onNavigateToAdmission: () -> Unit = {},
    onNavigateToPlans: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GymOnyxBackground)
            .verticalScroll(scrollState)
            .padding(20.dp)
    ) {
        // Dashboard Title & Refresh
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Gym Dashboard",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = TextPrimary
                )
                Text(
                    text = "Live membership operations and renewal alerts",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }

            IconButton(onClick = viewModel::refreshDashboard) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = ShapeOrangePrimary, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = TextSecondary)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Backup Reminder Banner (If no backup taken in 7 days)
        if (uiState.metrics.needsBackupWarning) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFF2C2416))
                    .border(1.dp, AlertYellow.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = AlertYellow, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Backup Reminder",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = AlertYellow
                        )
                        Text(
                            text = "No backup has been taken in over 7 days. Export a secure database backup in Settings.",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // ==========================================
        // KEY METRICS GRID
        // ==========================================
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Total & Active Members
            MetricCard(
                title = "Total Members",
                value = uiState.metrics.totalMembers.toString(),
                subtitle = "${uiState.metrics.activeMembers} currently active",
                icon = Icons.Default.Group,
                accentColor = ShapeOrangePrimary,
                modifier = Modifier.weight(1f)
            )

            // Today's Collection
            MetricCard(
                title = "Today's Collection",
                value = CurrencyFormatter.formatInr(uiState.metrics.todayCollection),
                subtitle = "Collected today",
                icon = Icons.Default.CurrencyRupee,
                accentColor = AlertGreen,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Expiring Soon (Yellow + Red)
            MetricCard(
                title = "Renewals Due",
                value = (uiState.metrics.expiringSoonCount + uiState.metrics.criticalCount).toString(),
                subtitle = "${uiState.metrics.criticalCount} Critical (≤3d) • ${uiState.metrics.expiredCount} Expired",
                icon = Icons.Default.NotificationsActive,
                accentColor = AlertRed,
                modifier = Modifier.weight(1f)
            )

            // Total Pending Dues
            MetricCard(
                title = "Pending Dues",
                value = CurrencyFormatter.formatInr(uiState.metrics.totalPendingDues),
                subtitle = "Unpaid balances",
                icon = Icons.Default.HourglassTop,
                accentColor = AlertYellow,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // ==========================================
        // SECTION: RENEWALS DUE (COLOR CODED CARDS)
        // ==========================================
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.HourglassBottom, contentDescription = null, tint = ShapeOrangePrimary, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Renewals Due",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            }

            Text(
                text = "${uiState.renewalsDue.size} Members",
                fontSize = 12.sp,
                color = TextSecondary,
                fontWeight = FontWeight.Medium
            )
        }

        Text(
            text = "Color-coded: Red (≤3 days), Yellow (≤7 days), Dark Red (Expired)",
            fontSize = 11.sp,
            color = TextMuted,
            modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
        )

        if (uiState.renewalsDue.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(GymSurfaceCard, RoundedCornerShape(16.dp))
                    .border(1.dp, GymBorder, RoundedCornerShape(16.dp))
                    .padding(28.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = AlertGreen, modifier = Modifier.size(36.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("All memberships active and up-to-date!", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text("No renewals due in the next 7 days.", color = TextMuted, fontSize = 12.sp)
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                uiState.renewalsDue.forEach { item ->
                    RenewalAlertCard(
                        item = item,
                        onCall = { viewModel.onCallMember(context, item.phone) },
                        onWhatsApp = {
                            viewModel.onWhatsAppReminder(
                                context,
                                item.name,
                                item.phone,
                                item.planName,
                                item.expiryDateIso,
                                item.pendingBalance
                            )
                        },
                        onRenew = { viewModel.openRenewDialog(item) }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Sync & Connection Status Strip
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF1E222A), RoundedCornerShape(10.dp))
                .border(1.dp, GymBorder, RoundedCornerShape(10.dp))
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Sync,
                    contentDescription = null,
                    tint = if (uiState.metrics.isOffline) AlertYellow else AlertGreen,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (uiState.metrics.isOffline) "Offline Cache Active" else "Cloud Synchronized",
                    fontSize = 12.sp,
                    color = TextPrimary,
                    fontWeight = FontWeight.Medium
                )
            }

            if (uiState.metrics.pendingSyncCount > 0) {
                Text(
                    text = "${uiState.metrics.pendingSyncCount} pending syncs",
                    fontSize = 11.sp,
                    color = AlertYellow,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Text(
                    text = "All data cached locally",
                    fontSize = 11.sp,
                    color = TextMuted
                )
            }
        }

        Spacer(modifier = Modifier.height(30.dp))
    }

    // Renewal Dialog
    if (uiState.selectedRenewalItem != null) {
        RenewMembershipDialog(
            item = uiState.selectedRenewalItem!!,
            availablePlans = uiState.availablePlans,
            isRenewing = uiState.isRenewing,
            errorMessage = uiState.renewalError,
            onDismiss = viewModel::closeRenewDialog,
            onConfirm = viewModel::submitRenewal
        )
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.border(1.dp, GymBorder, RoundedCornerShape(14.dp)),
        colors = CardDefaults.cardColors(containerColor = GymSurfaceCard),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = title, fontSize = 12.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(accentColor.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(imageVector = icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(16.dp))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(text = value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = TextPrimary)
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = subtitle, fontSize = 10.sp, color = TextMuted)
        }
    }
}

@Composable
private fun RenewalAlertCard(
    item: RenewalMemberItem,
    onCall: () -> Unit,
    onWhatsApp: () -> Unit,
    onRenew: () -> Unit
) {
    // Dynamic color coding according to gym specification:
    // 7 days or fewer: YELLOW card
    // 3 days or fewer: RED card
    // Expired: Dark red/grey card labelled "Expired"
    val (cardBg, borderColor, badgeStatus) = when (item.alertStatus) {
        ExpiryAlertStatus.CRITICAL -> Triple(Color(0xFF2C1618), AlertRed, ExpiryAlertStatus.CRITICAL)
        ExpiryAlertStatus.EXPIRING_SOON -> Triple(Color(0xFF2B2514), AlertYellow, ExpiryAlertStatus.EXPIRING_SOON)
        ExpiryAlertStatus.EXPIRED -> Triple(AlertExpiredCardBg, AlertExpiredDark, ExpiryAlertStatus.EXPIRED)
        ExpiryAlertStatus.ACTIVE -> Triple(GymSurfaceCard, GymBorder, ExpiryAlertStatus.ACTIVE)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.2.dp, borderColor, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        text = item.name,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "${item.programNames.joinToString()} • ${item.planName}",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }

                ExpiryAlertBadge(status = badgeStatus, daysLeft = item.daysRemaining)
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Expiry Date & Pending Balance row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Expiry: ${DateUtils.formatDisplay(item.expiryDateIso)}",
                    fontSize = 12.sp,
                    color = TextSecondary
                )

                if (item.pendingBalance > 0) {
                    Text(
                        text = "Balance: ${CurrencyFormatter.formatInr(item.pendingBalance)} Pending",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = AlertRed
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Quick Actions: Call, WhatsApp Reminder, Renew
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Call Action
                OutlinedButton(
                    onClick = onCall,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Call, contentDescription = "Call", tint = AlertGreen, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Call", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }

                // WhatsApp Reminder Action
                OutlinedButton(
                    onClick = onWhatsApp,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1.3f)
                ) {
                    Icon(Icons.Default.Message, contentDescription = "WhatsApp", tint = AlertGreen, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("WhatsApp", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }

                // Renew Action
                Button(
                    onClick = onRenew,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ShapeOrangePrimary),
                    modifier = Modifier.weight(1.1f)
                ) {
                    Icon(Icons.Default.Autorenew, contentDescription = "Renew", tint = TextPrimary, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Renew", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
