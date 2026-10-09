package com.shape.gymapp.ui.screens.auth

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.ui.components.ShapePasswordTextField
import com.shape.gymapp.ui.components.ShapePrimaryButton
import com.shape.gymapp.ui.components.ShapeTextField
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
fun LoginScreen(
    onNavigate: (String) -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current
    val scrollState = rememberScrollState()

    LaunchedEffect(Unit) {
        viewModel.navigationEvent.collectLatest { route ->
            onNavigate(route)
        }
    }

    Surface(
        modifier = Modifier
            .fillMaxSize()
            .imePadding(),
        color = GymOnyxBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(20.dp))

            // Gym Brand Header
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(
                        brush = Brush.linearGradient(listOf(ShapeOrangePrimary, ShapeRedAccent)),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.FitnessCenter,
                    contentDescription = "Shape Logo",
                    tint = TextPrimary,
                    modifier = Modifier.size(42.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "SHAPE",
                fontSize = 32.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 3.sp,
                color = TextPrimary
            )

            Text(
                text = "GYM OWNER & STAFF PORTAL",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = ShapeOrangePrimary
            )

            Spacer(modifier = Modifier.height(36.dp))

            // Card container for login inputs
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(GymSurfaceCard)
                    .border(1.dp, GymBorder, RoundedCornerShape(20.dp))
                    .padding(24.dp)
            ) {
                Column {
                    Text(
                        text = "Sign In",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Text(
                        text = "Enter your credentials to access gym management",
                        fontSize = 13.sp,
                        color = TextSecondary,
                        modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
                    )

                    if (uiState.generalError != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(AlertRed.copy(alpha = 0.15f), RoundedCornerShape(10.dp))
                                .border(1.dp, AlertRed.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                                .padding(12.dp)
                        ) {
                            Text(
                                text = uiState.generalError ?: "",
                                color = AlertRed,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // Email Field
                    ShapeTextField(
                        value = uiState.email,
                        onValueChange = viewModel::onEmailChange,
                        label = "Email Address",
                        placeholder = "owner@shapegym.com",
                        leadingIcon = Icons.Default.Email,
                        errorMessage = uiState.emailError,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        enabled = !uiState.isLoading
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Password Field
                    ShapePasswordTextField(
                        value = uiState.password,
                        onValueChange = viewModel::onPasswordChange,
                        label = "Password",
                        placeholder = "••••••••",
                        leadingIcon = Icons.Default.Lock,
                        errorMessage = uiState.passwordError,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.onLoginClick()
                            }
                        ),
                        enabled = !uiState.isLoading
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Sign In Button
                    ShapePrimaryButton(
                        text = "Sign In to Shape",
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.onLoginClick()
                        },
                        isLoading = uiState.isLoading
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Security Notice
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Security,
                    contentDescription = "Security",
                    tint = TextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Role-Based RLS & Client-Side AES-256 Enabled",
                    color = TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
