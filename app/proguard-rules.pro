# Supabase Kotlin SDK
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keep class io.github.jan.supabase.** { *; }

# Kotlinx Serialization
-keepclassmembers class * {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}

# Room
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# SQLCipher / Security Crypto
-keep class androidx.security.crypto.** { *; }
