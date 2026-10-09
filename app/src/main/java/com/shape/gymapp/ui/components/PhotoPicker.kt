package com.shape.gymapp.ui.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shape.gymapp.ui.theme.AlertRed
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary
import java.io.ByteArrayOutputStream

@Composable
fun MemberPhotoPicker(
    onPhotoSelected: (ByteArray?) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var previewBitmap by remember { mutableStateOf<Bitmap?>(null) }

    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                val inputStream = context.contentResolver.openInputStream(uri)
                val bitmap = BitmapFactory.decodeStream(inputStream)
                inputStream?.close()
                if (bitmap != null) {
                    previewBitmap = bitmap
                    val stream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)
                    onPhotoSelected(stream.toByteArray())
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        if (bitmap != null) {
            previewBitmap = bitmap
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)
            onPhotoSelected(stream.toByteArray())
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(GymSurfaceCard)
            .border(1.dp, GymBorder, RoundedCornerShape(16.dp))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.AddAPhoto,
                contentDescription = null,
                tint = ShapeOrangePrimary,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Member Photo (Optional)",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (previewBitmap != null) {
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .clip(CircleShape)
                    .border(2.dp, ShapeOrangePrimary, CircleShape)
            ) {
                Image(
                    bitmap = previewBitmap!!.asImageBitmap(),
                    contentDescription = "Member Photo Preview",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                IconButton(
                    onClick = {
                        previewBitmap = null
                        onPhotoSelected(null)
                    },
                    modifier = Modifier
                        .size(28.dp)
                        .align(Alignment.TopEnd)
                        .background(AlertRed, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remove Photo",
                        tint = TextPrimary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        } else {
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = { cameraLauncher.launch(null) },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CameraAlt,
                        contentDescription = "Camera",
                        tint = TextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Take Photo", color = TextSecondary, fontSize = 12.sp)
                }

                OutlinedButton(
                    onClick = { galleryLauncher.launch("image/*") },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PhotoLibrary,
                        contentDescription = "Gallery",
                        tint = TextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Choose Gallery", color = TextSecondary, fontSize = 12.sp)
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Captured photos are stored in private encrypted storage",
                color = TextMuted,
                fontSize = 11.sp
            )
        }
    }
}
