package com.shape.gymapp.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = ShapeOrangePrimary,
    onPrimary = TextPrimary,
    primaryContainer = ShapeOrangeDark,
    onPrimaryContainer = TextPrimary,
    secondary = ShapeRedAccent,
    onSecondary = TextPrimary,
    background = GymOnyxBackground,
    onBackground = TextPrimary,
    surface = GymSurfaceDark,
    onSurface = TextPrimary,
    surfaceVariant = GymSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    outline = GymBorder,
    error = AlertRed,
    onError = TextPrimary
)

@Composable
fun ShapeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    // Fitness Gym theme is tailored to high-contrast Dark theme by default
    val colorScheme = DarkColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = GymOnyxBackground.toArgb()
            window.navigationBarColor = GymOnyxBackground.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = Shapes,
        content = content
    )
}
