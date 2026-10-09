package com.shape.gymapp.core.util

import java.text.DecimalFormat
import java.text.NumberFormat
import java.util.Locale

object CurrencyFormatter {

    /**
     * Formats an amount into Indian Rupees (INR) format:
     * Examples: 4999 -> "₹4,999", 150000 -> "₹1,50,000"
     */
    fun formatInr(amount: Double): String {
        return try {
            val formatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
            val formatted = formatter.format(amount)
            // Replace non-breaking spaces or generic INR code if necessary
            formatted.replace("INR", "₹").trim()
        } catch (e: Exception) {
            "₹" + DecimalFormat("#,##,##0").format(amount)
        }
    }

    fun formatInr(amount: Long): String = formatInr(amount.toDouble())

    fun formatInr(amount: Int): String = formatInr(amount.toDouble())
}
