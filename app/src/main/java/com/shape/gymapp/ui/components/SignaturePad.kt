package com.shape.gymapp.ui.components

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Draw
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary
import java.io.ByteArrayOutputStream

data class PathPoint(val points: List<Offset>)

@Composable
fun SignaturePad(
    title: String,
    onSignatureChanged: (ByteArray?) -> Unit,
    modifier: Modifier = Modifier
) {
    val paths = remember { mutableStateListOf<PathPoint>() }
    val undonePaths = remember { mutableStateListOf<PathPoint>() }
    var currentPathPoints by remember { mutableStateOf<List<Offset>>(emptyList()) }
    var isSigned by remember { mutableStateOf(false) }

    fun updateExport() {
        if (paths.isEmpty()) {
            isSigned = false
            onSignatureChanged(null)
        } else {
            isSigned = true
            val bitmap = createBitmapFromPaths(paths, 400, 200)
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            onSignatureChanged(stream.toByteArray())
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(GymSurfaceCard)
            .border(1.dp, if (isSigned) AlertGreen.copy(alpha = 0.5f) else GymBorder, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Draw,
                    contentDescription = null,
                    tint = ShapeOrangePrimary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            }

            if (isSigned) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Signed",
                        tint = AlertGreen,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Signed",
                        color = AlertGreen,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            } else {
                Text(
                    text = "Signature Required",
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Drawing Canvas Box
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF16181D))
                .border(1.dp, Color(0xFF2E323B), RoundedCornerShape(12.dp))
        ) {
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = { offset ->
                                currentPathPoints = listOf(offset)
                                undonePaths.clear()
                            },
                            onDrag = { change, _ ->
                                change.consume()
                                currentPathPoints = currentPathPoints + change.position
                            },
                            onDragEnd = {
                                if (currentPathPoints.isNotEmpty()) {
                                    paths.add(PathPoint(currentPathPoints))
                                    currentPathPoints = emptyList()
                                    updateExport()
                                }
                            }
                        )
                    }
            ) {
                // Draw existing paths
                for (pathPoint in paths) {
                    if (pathPoint.points.size > 1) {
                        val path = Path().apply {
                            moveTo(pathPoint.points.first().x, pathPoint.points.first().y)
                            for (p in pathPoint.points.drop(1)) {
                                lineTo(p.x, p.y)
                            }
                        }
                        drawPath(
                            path = path,
                            color = Color.White,
                            style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
                        )
                    }
                }

                // Draw currently dragging path
                if (currentPathPoints.size > 1) {
                    val path = Path().apply {
                        moveTo(currentPathPoints.first().x, currentPathPoints.first().y)
                        for (p in currentPathPoints.drop(1)) {
                            lineTo(p.x, p.y)
                        }
                    }
                    drawPath(
                        path = path,
                        color = ShapeOrangePrimary,
                        style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
                    )
                }
            }

            if (paths.isEmpty() && currentPathPoints.isEmpty()) {
                Text(
                    text = "Draw signature with finger here",
                    color = Color(0xFF555B66),
                    fontSize = 13.sp,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Action Buttons: Clear, Undo, Redo
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Undo
            OutlinedButton(
                onClick = {
                    if (paths.isNotEmpty()) {
                        val last = paths.removeAt(paths.lastIndex)
                        undonePaths.add(last)
                        updateExport()
                    }
                },
                enabled = paths.isNotEmpty(),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.Undo, contentDescription = "Undo", tint = TextSecondary, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Undo", color = TextSecondary, fontSize = 12.sp)
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Redo
            OutlinedButton(
                onClick = {
                    if (undonePaths.isNotEmpty()) {
                        val last = undonePaths.removeAt(undonePaths.lastIndex)
                        paths.add(last)
                        updateExport()
                    }
                },
                enabled = undonePaths.isNotEmpty(),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.Redo, contentDescription = "Redo", tint = TextSecondary, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Redo", color = TextSecondary, fontSize = 12.sp)
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Clear
            OutlinedButton(
                onClick = {
                    paths.clear()
                    undonePaths.clear()
                    updateExport()
                },
                enabled = paths.isNotEmpty(),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextSecondary, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Clear", color = TextSecondary, fontSize = 12.sp)
            }
        }
    }
}

private fun createBitmapFromPaths(paths: List<PathPoint>, width: Int, height: Int): Bitmap {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint().apply {
        color = android.graphics.Color.BLACK
        strokeWidth = 5f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        isAntiAlias = true
    }

    for (p in paths) {
        if (p.points.size > 1) {
            val path = android.graphics.Path().apply {
                moveTo(p.points.first().x, p.points.first().y)
                for (pt in p.points.drop(1)) {
                    lineTo(pt.x, pt.y)
                }
            }
            canvas.drawPath(path, paint)
        }
    }
    return bitmap
}
