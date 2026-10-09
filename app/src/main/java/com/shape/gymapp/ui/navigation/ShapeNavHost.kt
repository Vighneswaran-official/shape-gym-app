package com.shape.gymapp.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.shape.gymapp.ui.screens.auth.LoginScreen
import com.shape.gymapp.ui.screens.lock.PinLockScreen
import com.shape.gymapp.ui.screens.main.MainScreen
import com.shape.gymapp.ui.screens.splash.SplashScreen

@Composable
fun ShapeNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = NavRoute.Splash.route,
        modifier = modifier,
        enterTransition = {
            fadeIn(animationSpec = tween(300)) + slideIntoContainer(
                AnimatedContentTransitionScope.SlideDirection.Start,
                animationSpec = tween(300)
            )
        },
        exitTransition = {
            fadeOut(animationSpec = tween(300)) + slideOutOfContainer(
                AnimatedContentTransitionScope.SlideDirection.Start,
                animationSpec = tween(300)
            )
        },
        popEnterTransition = {
            fadeIn(animationSpec = tween(300)) + slideIntoContainer(
                AnimatedContentTransitionScope.SlideDirection.End,
                animationSpec = tween(300)
            )
        },
        popExitTransition = {
            fadeOut(animationSpec = tween(300)) + slideOutOfContainer(
                AnimatedContentTransitionScope.SlideDirection.End,
                animationSpec = tween(300)
            )
        }
    ) {
        composable(NavRoute.Splash.route) {
            SplashScreen(
                onNavigate = { targetRoute ->
                    navController.navigate(targetRoute) {
                        popUpTo(NavRoute.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        composable(NavRoute.Login.route) {
            LoginScreen(
                onNavigate = { targetRoute ->
                    navController.navigate(targetRoute) {
                        popUpTo(NavRoute.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(NavRoute.PinLock.route) {
            PinLockScreen(
                onNavigate = { targetRoute ->
                    navController.navigate(targetRoute) {
                        popUpTo(NavRoute.PinLock.route) { inclusive = true }
                    }
                }
            )
        }

        composable(NavRoute.PinSetup.route) {
            PinLockScreen(
                onNavigate = { targetRoute ->
                    navController.navigate(targetRoute) {
                        popUpTo(NavRoute.PinSetup.route) { inclusive = true }
                    }
                }
            )
        }

        composable(NavRoute.Main.route) {
            MainScreen(
                onNavigate = { targetRoute ->
                    navController.navigate(targetRoute) {
                        popUpTo(NavRoute.Main.route) { inclusive = true }
                    }
                }
            )
        }
    }
}
