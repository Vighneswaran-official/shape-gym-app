package com.shape.gymapp.core.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CryptoManager @Inject constructor() {

    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply {
        load(null)
    }

    companion object {
        private const val KEY_ALIAS = "shape_gym_master_key"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH = 128
        private const val GCM_IV_LENGTH = 12
        private const val ITERATIONS = 10000
        private const val KEY_LENGTH = 256
    }

    init {
        ensureKeyStoreKey()
    }

    private fun ensureKeyStoreKey() {
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                "AndroidKeyStore"
            )
            val parameterSpec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
            keyGenerator.init(parameterSpec)
            keyGenerator.generateKey()
        }
    }

    private fun getSecretKey(): SecretKey {
        return (keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry).secretKey
    }

    /**
     * Encrypts plaintext string using AES-256-GCM hardware key.
     * Output format: Base64(IV + Ciphertext)
     */
    fun encrypt(plainText: String): String {
        if (plainText.isEmpty()) return ""
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getSecretKey())
        val iv = cipher.iv
        val encryptedBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val combined = ByteArray(iv.size + encryptedBytes.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(encryptedBytes, 0, combined, iv.size, encryptedBytes.size)
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    /**
     * Decrypts Base64(IV + Ciphertext) into plaintext.
     */
    fun decrypt(encryptedBase64: String): String {
        if (encryptedBase64.isEmpty()) return ""
        val combined = Base64.decode(encryptedBase64, Base64.NO_WRAP)
        if (combined.size < GCM_IV_LENGTH) return ""

        val iv = ByteArray(GCM_IV_LENGTH)
        val cipherText = ByteArray(combined.size - GCM_IV_LENGTH)
        System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH)
        System.arraycopy(combined, GCM_IV_LENGTH, cipherText, 0, cipherText.size)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, getSecretKey(), spec)
        val decryptedBytes = cipher.doFinal(cipherText)
        return String(decryptedBytes, Charsets.UTF_8)
    }

    /**
     * Derives an AES-256 key from an Admin Gym Passphrase with salt for sensitive member data (Aadhaar & Health History)
     */
    fun deriveKeyFromPassphrase(passphrase: String, salt: ByteArray): SecretKey {
        val spec = PBEKeySpec(passphrase.toCharArray(), salt, ITERATIONS, KEY_LENGTH)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val secretBytes = factory.generateSecret(spec).encoded
        return SecretKeySpec(secretBytes, "AES")
    }

    /**
     * Utility to format Aadhaar for display as XXXX-XXXX-1234
     */
    fun maskAadhaar(raw12Digits: String): String {
        val clean = raw12Digits.replace("\\s".toRegex(), "")
        return if (clean.length == 12) {
            "XXXX-XXXX-${clean.takeLast(4)}"
        } else if (clean.length >= 4) {
            "XXXX-XXXX-${clean.takeLast(4)}"
        } else {
            "XXXX-XXXX-XXXX"
        }
    }
}
