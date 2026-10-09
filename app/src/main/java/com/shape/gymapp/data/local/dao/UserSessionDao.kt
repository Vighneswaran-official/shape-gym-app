package com.shape.gymapp.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.shape.gymapp.data.local.entity.UserSessionEntity

@Dao
interface UserSessionDao {

    @Query("SELECT * FROM user_sessions ORDER BY lastActiveTime DESC LIMIT 1")
    suspend fun getActiveSession(): UserSessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: UserSessionEntity)

    @Query("DELETE FROM user_sessions")
    suspend fun clearSession()
}
