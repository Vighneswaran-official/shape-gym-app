package com.shape.gymapp.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PinLockManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "shape_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_PIN_HASH = "key_pin_hash"
        private const val KEY_PIN_ENABLED = "key_pin_enabled"
        private const val KEY_BIOMETRIC_ENABLED = "key_biometric_enabled"
        private const val KEY_PASSPHRASE_SET = "key_passphrase_set"
    }

    private var isSessionUnlocked: Boolean = false

    fun isPinSet(): Boolean {
        return sharedPreferences.contains(KEY_PIN_HASH) && sharedPreferences.getBoolean(KEY_PIN_ENABLED, false)
    }

    fun isBiometricEnabled(): Boolean {
        return sharedPreferences.getBoolean(KEY_BIOMETRIC_ENABLED, false)
    }

    fun setBiometricEnabled(enabled: Boolean) {
        sharedPreferences.edit().putBoolean(KEY_BIOMETRIC_ENABLED, enabled).apply()
    }

    fun savePin(pin: String) {
        val hash = hashPin(pin)
        sharedPreferences.edit()
            .putString(KEY_PIN_HASH, hash)
            .putBoolean(KEY_PIN_ENABLED, true)
            .apply()
        isSessionUnlocked = true
    }

    fun verifyPin(pin: String): Boolean {
        val storedHash = sharedPreferences.getString(KEY_PIN_HASH, null) ?: return false
        val enteredHash = hashPin(pin)
        val valid = (storedHash == enteredHash)
        if (valid) {
            isSessionUnlocked = true
        }
        return valid
    }

    fun isUnlockedForSession(): Boolean = isSessionUnlocked

    fun setSessionUnlocked(unlocked: Boolean) {
        isSessionUnlocked = unlocked
    }

    fun clearPin() {
        sharedPreferences.edit()
            .remove(KEY_PIN_HASH)
            .putBoolean(KEY_PIN_ENABLED, false)
            .apply()
        isSessionUnlocked = false
    }

    private fun hashPin(pin: String): String {
        val salt = "shape_gym_salt_secure_2026"
        val bytes = MessageDigest.getInstance("SHA-256").digest((pin + salt).toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
