package com.shape.gymapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shape.gymapp.core.util.ExpiryAlertStatus
import com.shape.gymapp.domain.model.UserRole
import com.shape.gymapp.ui.theme.AlertExpiredDark
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.AlertYellow
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextPrimary

@Composable
fun RoleBadge(
    role: UserRole,
    modifier: Modifier = Modifier
) {
    val (bg, textColor, label) = when (role) {
        UserRole.ADMIN -> Triple(ShapeOrangePrimary.copy(alpha = 0.2f), ShapeOrangePrimary, "MANAGER / ADMIN")
        UserRole.STAFF -> Triple(Color(0xFF2196F3).copy(alpha = 0.2f), Color(0xFF64B5F6), "STAFF")
    }

    Box(
        modifier = modifier
            .background(bg, shape = RoundedCornerShape(6.dp))
            .border(1.dp, textColor.copy(alpha = 0.5f), shape = RoundedCornerShape(6.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
fun ExpiryAlertBadge(
    status: ExpiryAlertStatus,
    daysLeft: Long,
    modifier: Modifier = Modifier
) {
    val (bg, textColor, label) = when (status) {
        ExpiryAlertStatus.ACTIVE -> Triple(AlertGreen.copy(alpha = 0.15f), AlertGreen, "Active ($daysLeft d)")
        ExpiryAlertStatus.EXPIRING_SOON -> Triple(AlertYellow.copy(alpha = 0.18f), AlertYellow, "Expiring ($daysLeft d)")
        ExpiryAlertStatus.CRITICAL -> Triple(AlertRed.copy(alpha = 0.22f), AlertRed, "Critical ($daysLeft d)")
        ExpiryAlertStatus.EXPIRED -> Triple(AlertExpiredDark.copy(alpha = 0.35f), Color(0xFFFFA4A4), "Expired (${-daysLeft} d ago)")
    }

    Box(
        modifier = modifier
            .background(bg, shape = RoundedCornerShape(8.dp))
            .border(1.dp, textColor.copy(alpha = 0.6f), shape = RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
