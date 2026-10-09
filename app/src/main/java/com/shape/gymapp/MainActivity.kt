package com.shape.gymapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.shape.gymapp.ui.navigation.ShapeNavHost
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.ShapeTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            ShapeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = GymOnyxBackground
                ) {
                    val navController = rememberNavController()
                    ShapeNavHost(navController = navController)
                }
            }
        }
    }
}
