package com.shape.gymapp.ui.screens.members

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.domain.model.Member
import com.shape.gymapp.ui.theme.AlertGreen
import com.shape.gymapp.ui.theme.GymBorder
import com.shape.gymapp.ui.theme.GymOnyxBackground
import com.shape.gymapp.ui.theme.GymSurfaceCard
import com.shape.gymapp.ui.theme.ShapeOrangePrimary
import com.shape.gymapp.ui.theme.TextMuted
import com.shape.gymapp.ui.theme.TextPrimary
import com.shape.gymapp.ui.theme.TextSecondary

@Composable
fun MembersScreen(
    viewModel: MembersViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GymOnyxBackground)
            .padding(20.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Members Directory",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = TextPrimary
                )
                Text(
                    text = "${uiState.filteredMembers.size} registered members",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }

            IconButton(onClick = viewModel::refresh) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = ShapeOrangePrimary, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = TextSecondary)
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Search Bar
        OutlinedTextField(
            value = uiState.searchQuery,
            onValueChange = viewModel::onSearchQueryChange,
            placeholder = { Text("Search by name or 10-digit mobile...", color = TextMuted) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
            trailingIcon = {
                if (uiState.searchQuery.isNotEmpty()) {
                    IconButton(onClick = { viewModel.onSearchQueryChange("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextSecondary)
                    }
                }
            },
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = GymSurfaceCard,
                unfocusedContainerColor = GymSurfaceCard,
                focusedBorderColor = ShapeOrangePrimary,
                unfocusedBorderColor = GymBorder,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Program Filters
        if (uiState.programs.isNotEmpty()) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                item {
                    val isAll = uiState.selectedProgramId == null
                    FilterChip(
                        selected = isAll,
                        onClick = { viewModel.onProgramFilterSelected(null) },
                        label = { Text("All Programs", fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ShapeOrangePrimary,
                            selectedLabelColor = TextPrimary
                        )
                    )
                }
                items(uiState.programs) { prog ->
                    val isSelected = uiState.selectedProgramId == prog.id
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            viewModel.onProgramFilterSelected(if (isSelected) null else prog.id)
                        },
                        label = { Text(prog.name, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ShapeOrangePrimary,
                            selectedLabelColor = TextPrimary
                        )
                    )
                }
            }
            Spacer(modifier = Modifier.height(14.dp))
        }

        // Members List
        if (uiState.filteredMembers.isEmpty() && !uiState.isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("No members found matching your search", color = TextMuted, fontSize = 14.sp)
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(uiState.filteredMembers, key = { it.id }) { member ->
                    MemberRowCard(member = member)
                }
            }
        }
    }
}

@Composable
private fun MemberRowCard(member: Member) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, GymBorder, RoundedCornerShape(14.dp)),
        colors = CardDefaults.cardColors(containerColor = GymSurfaceCard),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(ShapeOrangePrimary.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    tint = ShapeOrangePrimary,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = member.name,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Phone, contentDescription = null, tint = TextMuted, modifier = Modifier.size(12.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "+91 ${member.phone}",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                    if (member.aadhaarLast4 != null) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "• Aadhaar: •••• ${member.aadhaarLast4}",
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Joined: ${DateUtils.formatDisplay(member.joinDate)}",
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                    if (member.bloodGroup != null) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "• ${member.bloodGroup.display}",
                            fontSize = 11.sp,
                            color = AlertGreen,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
