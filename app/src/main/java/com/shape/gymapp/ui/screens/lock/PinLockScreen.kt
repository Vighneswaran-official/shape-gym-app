package com.shape.gymapp.ui.screens.lock

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.ShapeRedAccent
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary
import kotlinx.coroutines.flow.collectLatest

@Composable
fun PinLockScreen(
    onNavigate: (String) -> Unit,
    viewModel: PinLockViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvent.collectLatest { route ->
            onNavigate(route)
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = GymOnyxBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header Section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 24.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(
                            brush = Brush.linearGradient(listOf(ShapeOrangePrimary, ShapeRedAccent)),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "App Lock",
                        tint = TextPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                val title = when (uiState.mode) {
                    PinMode.UNLOCK -> "Enter Front-Desk PIN"
                    PinMode.SETUP_FIRST -> "Create Front-Desk PIN"
                    PinMode.SETUP_CONFIRM -> "Confirm 4-Digit PIN"
                }

                Text(
                    text = title,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )

                val subtitle = when (uiState.mode) {
                    PinMode.UNLOCK -> "Enter your 4-digit PIN to access Shape gym data"
                    PinMode.SETUP_FIRST -> "Set a 4-digit PIN for quick front-desk terminal unlocking"
                    PinMode.SETUP_CONFIRM -> "Re-enter the same 4 digits to confirm"
                }

                Text(
                    text = subtitle,
                    fontSize = 13.sp,
                    color = TextSecondary,
                    modifier = Modifier.padding(top = 6.dp)
                )

                Spacer(modifier = Modifier.height(28.dp))

                // 4 PIN Dots
                Row(
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(4) { index ->
                        val isFilled = index < uiState.enteredPin.length
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(if (isFilled) ShapeOrangePrimary else GymSurfaceCard)
                                .border(
                                    1.5.dp,
                                    if (isFilled) ShapeOrangePrimary else GymBorder,
                                    CircleShape
                                )
                        )
                    }
                }

                if (uiState.errorMessage != null) {
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = uiState.errorMessage ?: "",
                        color = AlertRed,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Keypad Section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.padding(bottom = 16.dp)
            ) {
                val rows = listOf(
                    listOf("1", "2", "3"),
                    listOf("4", "5", "6"),
                    listOf("7", "8", "9")
                )

                for (row in rows) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(24.dp),
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        for (digit in row) {
                            KeypadButton(
                                text = digit,
                                onClick = { viewModel.onNumberClick(digit) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }

                // Bottom Row: Biometric / Empty, "0", Backspace
                Row(
                    horizontalArrangement = Arrangement.spacedBy(24.dp),
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Left Action (Biometric if enabled)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(68.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (uiState.mode == PinMode.UNLOCK && uiState.isBiometricAvailable) {
                            IconButtonBox(
                                icon = Icons.Default.Fingerprint,
                                onClick = { viewModel.onBiometricSuccess() }
                            )
                        }
                    }

                    // Digit 0
                    KeypadButton(
                        text = "0",
                        onClick = { viewModel.onNumberClick("0") },
                        modifier = Modifier.weight(1f)
                    )

                    // Backspace
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(68.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        IconButtonBox(
                            icon = Icons.Default.Backspace,
                            onClick = { viewModel.onDeleteClick() }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(onClick = viewModel::onLogoutClick) {
                    Text(
                        text = "Switch Account or Sign Out",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun KeypadButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(68.dp)
            .clip(CircleShape)
            .background(GymSurfaceCard)
            .border(1.dp, GymBorder, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )
    }
}

@Composable
private fun IconButtonBox(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(68.dp)
            .clip(CircleShape)
            .background(Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = TextSecondary,
            modifier = Modifier.size(28.dp)
        )
    }
}
