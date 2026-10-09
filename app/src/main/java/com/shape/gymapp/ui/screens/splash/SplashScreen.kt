package com.shape.gymapp.ui.screens.splash

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.ShapeRedAccent
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import kotlinx.coroutines.flow.collectLatest

@Composable
fun SplashScreen(
    onNavigate: (String) -> Unit,
    viewModel: SplashViewModel = hiltViewModel()
) {
    var startAnimation by remember { mutableStateOf(false) }

    val alphaAnim by animateFloatAsState(
        targetValue = if (startAnimation) 1f else 0f,
        animationSpec = tween(durationMillis = 800, easing = FastOutSlowInEasing),
        label = "SplashAlpha"
    )

    val scaleAnim by animateFloatAsState(
        targetValue = if (startAnimation) 1f else 0.85f,
        animationSpec = tween(durationMillis = 800, easing = FastOutSlowInEasing),
        label = "SplashScale"
    )

    LaunchedEffect(Unit) {
        startAnimation = true
        viewModel.navigationEvent.collectLatest { route ->
            onNavigate(route)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(GymOnyxBackground),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterVertically,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .alpha(alphaAnim)
                .scale(scaleAnim)
        ) {
            // Glow Dumbbell Icon Circle
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .background(
                        brush = Brush.radialGradient(
                            colors = listOf(ShapeOrangePrimary.copy(alpha = 0.35f), Color.Transparent)
                        ),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
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
                        modifier = Modifier.size(36.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "SHAPE",
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 4.sp,
                    color = TextPrimary
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "GYM MANAGEMENT & MEMBERSHIPS",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                color = ShapeOrangePrimary
            )

            Spacer(modifier = Modifier.height(48.dp))

            CircularProgressIndicator(
                modifier = Modifier.size(32.dp),
                color = ShapeOrangePrimary,
                strokeWidth = 3.dp
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Initializing Supabase & Secure Storage...",
                fontSize = 12.sp,
                color = TextMuted
            )
        }
    }
}
