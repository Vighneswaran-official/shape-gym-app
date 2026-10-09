package com.shape.gymapp.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary

@Composable
fun ShapeTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    leadingIcon: ImageVector? = null,
    errorMessage: String? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    singleLine: Boolean = true,
    enabled: Boolean = true
) {
    val isError = errorMessage != null

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label, color = if (isError) AlertRed else TextSecondary) },
            placeholder = placeholder?.let { { Text(it, color = TextMuted) } },
            leadingIcon = leadingIcon?.let {
                { Icon(it, contentDescription = null, tint = if (isError) AlertRed else TextSecondary) }
            },
            isError = isError,
            singleLine = singleLine,
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = GymSurfaceCard,
                unfocusedContainerColor = GymSurfaceCard,
                disabledContainerColor = Color(0xFF1E2024),
                focusedBorderColor = ShapeOrangePrimary,
                unfocusedBorderColor = GymBorder,
                errorBorderColor = AlertRed,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                cursorColor = ShapeOrangePrimary
            ),
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            modifier = Modifier.fillMaxWidth()
        )

        if (errorMessage != null) {
            Text(
                text = errorMessage,
                color = AlertRed,
                fontSize = 12.sp,
                modifier = Modifier.padding(start = 12.dp, top = 4.dp)
            )
        }
    }
}

@Composable
fun ShapePasswordTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    leadingIcon: ImageVector? = null,
    errorMessage: String? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    enabled: Boolean = true
) {
    var passwordVisible by remember { mutableStateOf(false) }
    val isError = errorMessage != null

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label, color = if (isError) AlertRed else TextSecondary) },
            placeholder = placeholder?.let { { Text(it, color = TextMuted) } },
            leadingIcon = leadingIcon?.let {
                { Icon(it, contentDescription = null, tint = if (isError) AlertRed else TextSecondary) }
            },
            trailingIcon = {
                val image = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff
                val description = if (passwordVisible) "Hide password" else "Show password"
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(image, contentDescription = description, tint = TextSecondary)
                }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            isError = isError,
            singleLine = true,
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = GymSurfaceCard,
                unfocusedContainerColor = GymSurfaceCard,
                disabledContainerColor = Color(0xFF1E2024),
                focusedBorderColor = ShapeOrangePrimary,
                unfocusedBorderColor = GymBorder,
                errorBorderColor = AlertRed,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                cursorColor = ShapeOrangePrimary
            ),
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            modifier = Modifier.fillMaxWidth()
        )

        if (errorMessage != null) {
            Text(
                text = errorMessage,
                color = AlertRed,
                fontSize = 12.sp,
                modifier = Modifier.padding(start = 12.dp, top = 4.dp)
            )
        }
    }
}
