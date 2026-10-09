package com.shape.gymapp.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.CardMembership
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.ui.components.OfflineBanner
import com.shape.gymapp.ui.screens.admission.AdmissionScreen
import com.shape.gymapp.ui.screens.dashboard.DashboardScreen
import com.shape.gymapp.ui.screens.members.MembersScreen
import com.shape.gymapp.ui.screens.plans.PlansScreen
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.GymSurfaceDark
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.ShapeRedAccent
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary
import kotlinx.coroutines.flow.collectLatest

@Composable
fun MainScreen(
    onNavigate: (String) -> Unit,
    viewModel: MainViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedBottomTab by remember { mutableIntStateOf(0) }
    var showPlansSubScreen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.navigationEvent.collectLatest { route ->
            onNavigate(route)
        }
    }

    Scaffold(
        containerColor = GymOnyxBackground,
        topBar = {
            Column {
                OfflineBanner(isOffline = uiState.isOffline)
                // App Top Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(GymSurfaceDark)
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(
                                    brush = Brush.linearGradient(listOf(ShapeOrangePrimary, ShapeRedAccent)),
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.FitnessCenter,
                                contentDescription = null,
                                tint = TextPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column {
                            Text(
                                text = "SHAPE",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp,
                                color = TextPrimary
                            )
                            Text(
                                text = "FITNESS CLUB",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                color = ShapeOrangePrimary
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Quick Plans Button (Admin access)
                        IconButton(onClick = { showPlansSubScreen = !showPlansSubScreen }) {
                            Icon(
                                imageVector = Icons.Default.CardMembership,
                                contentDescription = "Membership Plans",
                                tint = if (showPlansSubScreen) ShapeOrangePrimary else TextSecondary
                            )
                        }

                        // Logout Icon
                        IconButton(onClick = viewModel::logout) {
                            Icon(
                                imageVector = Icons.Default.ExitToApp,
                                contentDescription = "Sign Out",
                                tint = TextSecondary
                            )
                        }
                    }
                }
            }
        },
        bottomBar = {
            NavigationBar(
                containerColor = GymSurfaceDark,
                contentColor = TextPrimary
            ) {
                val navItems = listOf(
                    Triple(0, "Dashboard", Icons.Default.Dashboard),
                    Triple(1, "Members", Icons.Default.Group),
                    Triple(2, "Admission", Icons.Default.PersonAdd),
                    Triple(3, "Accounts", Icons.Default.Calculate),
                    Triple(4, "Plans", Icons.Default.CardMembership)
                )

                navItems.forEach { (index, title, icon) ->
                    val isSelected = (selectedBottomTab == index) && !showPlansSubScreen
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = {
                            selectedBottomTab = index
                            showPlansSubScreen = (index == 4)
                        },
                        icon = {
                            Icon(
                                imageVector = icon,
                                contentDescription = title,
                                tint = if (isSelected) ShapeOrangePrimary else TextMuted
                            )
                        },
                        label = {
                            Text(
                                text = title,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) ShapeOrangePrimary else TextMuted
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = ShapeOrangePrimary.copy(alpha = 0.15f)
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                showPlansSubScreen || selectedBottomTab == 4 -> {
                    PlansScreen()
                }
                selectedBottomTab == 0 -> {
                    DashboardScreen(
                        onNavigateToAdmission = { selectedBottomTab = 2 },
                        onNavigateToPlans = { showPlansSubScreen = true }
                    )
                }
                selectedBottomTab == 1 -> {
                    MembersScreen()
                }
                selectedBottomTab == 2 -> {
                    AdmissionScreen()
                }
                else -> {
                    DashboardScreen(
                        onNavigateToAdmission = { selectedBottomTab = 2 },
                        onNavigateToPlans = { showPlansSubScreen = true }
                    )
                }
            }
        }
    }
}
