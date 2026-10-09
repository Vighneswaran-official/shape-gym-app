package com.shape.gymapp.ui.screens.plans

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.domain.repository.PlanRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlansUiState(
    val plans: List<MembershipPlan> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isAddEditOpen: Boolean = false,
    val selectedPlanToEdit: MembershipPlan? = null
)

@HiltViewModel
class PlansViewModel @Inject constructor(
    private val planRepository: PlanRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlansUiState())
    val uiState = _uiState.asStateFlow()

    init {
        observePlans()
        refreshPlans()
    }

    private fun observePlans() {
        viewModelScope.launch {
            planRepository.getPlansFlow().collectLatest { plans ->
                _uiState.value = _uiState.value.copy(plans = plans)
            }
        }
    }

    fun refreshPlans() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val res = planRepository.refreshPlans()) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                is Resource.Loading -> Unit
            }
        }
    }

    fun openAddPlan() {
        _uiState.value = _uiState.value.copy(
            isAddEditOpen = true,
            selectedPlanToEdit = null
        )
    }

    fun openEditPlan(plan: MembershipPlan) {
        _uiState.value = _uiState.value.copy(
            isAddEditOpen = true,
            selectedPlanToEdit = plan
        )
    }

    fun closeAddEditDialog() {
        _uiState.value = _uiState.value.copy(
            isAddEditOpen = false,
            selectedPlanToEdit = null
        )
    }

    fun savePlan(name: String, durationDays: Int, fee: Double, description: String?, isActive: Boolean) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val currentEditing = _uiState.value.selectedPlanToEdit

            if (currentEditing == null) {
                // Add new plan
                val newPlan = MembershipPlan(
                    id = "",
                    name = name,
                    durationDays = durationDays,
                    fee = fee,
                    description = description,
                    isActive = isActive
                )
                planRepository.addPlan(newPlan)
            } else {
                // Update existing plan (Snapshot protection guaranteed: past subscriptions never affected)
                val updatedPlan = currentEditing.copy(
                    name = name,
                    durationDays = durationDays,
                    fee = fee,
                    description = description,
                    isActive = isActive
                )
                planRepository.updatePlan(updatedPlan)
            }

            closeAddEditDialog()
            refreshPlans()
        }
    }

    fun togglePlanActive(plan: MembershipPlan) {
        viewModelScope.launch {
            val updated = plan.copy(isActive = !plan.isActive)
            planRepository.updatePlan(updated)
            refreshPlans()
        }
    }

    fun deletePlan(planId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            planRepository.deletePlan(planId)
            refreshPlans()
        }
    }
}
