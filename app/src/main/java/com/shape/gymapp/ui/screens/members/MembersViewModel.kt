package com.shape.gymapp.ui.screens.members

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.domain.model.GymProgram
import com.shape.gymapp.domain.model.Member
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.domain.repository.MemberRepository
import com.shape.gymapp.domain.repository.PlanRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MembersUiState(
    val allMembers: List<Member> = emptyList(),
    val filteredMembers: List<Member> = emptyList(),
    val programs: List<GymProgram> = emptyList(),
    val plans: List<MembershipPlan> = emptyList(),
    val searchQuery: String = "",
    val selectedProgramId: String? = null,
    val selectedPlanId: String? = null,
    val isLoading: Boolean = false
)

@HiltViewModel
class MembersViewModel @Inject constructor(
    private val memberRepository: MemberRepository,
    private val planRepository: PlanRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MembersUiState())
    val uiState = _uiState.asStateFlow()

    init {
        observeMembers()
        loadFilters()
    }

    private fun observeMembers() {
        viewModelScope.launch {
            memberRepository.getAllMembersFlow().collectLatest { list ->
                _uiState.value = _uiState.value.copy(allMembers = list)
                applyFilters()
            }
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            memberRepository.refreshMembers()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private fun loadFilters() {
        viewModelScope.launch {
            planRepository.getProgramsFlow().collectLatest { progs ->
                _uiState.value = _uiState.value.copy(programs = progs)
            }
        }
        viewModelScope.launch {
            planRepository.getPlansFlow().collectLatest { plans ->
                _uiState.value = _uiState.value.copy(plans = plans)
            }
        }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        applyFilters()
    }

    fun onProgramFilterSelected(programId: String?) {
        _uiState.value = _uiState.value.copy(selectedProgramId = programId)
        applyFilters()
    }

    fun onPlanFilterSelected(planId: String?) {
        _uiState.value = _uiState.value.copy(selectedPlanId = planId)
        applyFilters()
    }

    private fun applyFilters() {
        val state = _uiState.value
        val query = state.searchQuery.trim().lowercase()

        val filtered = state.allMembers.filter { m ->
            val matchesQuery = query.isEmpty() ||
                    m.name.lowercase().contains(query) ||
                    m.phone.contains(query)

            matchesQuery
        }

        _uiState.value = state.copy(filteredMembers = filtered)
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            memberRepository.refreshMembers()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }
}
