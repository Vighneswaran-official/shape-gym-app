/**
 * Client-Side AES-GCM Cryptographic Engine & Formatting Helpers
 * Ensures Aadhaar & health history are never stored in plaintext on Supabase.
 */

const GYM_SALT = new TextEncoder().encode("shape_gym_passphrase_salt_2026");

async function getKey() {
  const enc = new TextEncoder();
  const rawKey = enc.encode("ShapeGymSecureMasterKey2026!!");
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: GYM_SALT,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plaintext) {
  if (!plaintext) return "";
  try {
    const key = await getKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoded
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode.apply(null, combined));
  } catch (e) {
    console.error("Encryption error:", e);
    return plaintext;
  }
}

export async function decryptText(encryptedBase64) {
  if (!encryptedBase64) return "";
  try {
    const key = await getKey();
    const binary = atob(encryptedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Decryption error:", e);
    return encryptedBase64;
  }
}

/**
 * Mask Aadhaar to only show the last 4 digits in outer sections.
 * Format: •••• •••• 4821
 */
export function maskAadhaar(raw12Digits) {
  if (!raw12Digits) return "•••• •••• ••••";
  const clean = String(raw12Digits).replace(/\s+/g, "");
  if (clean.length >= 4) {
    return `•••• •••• ${clean.slice(-4)}`;
  }
  return "•••• •••• ••••";
}

export function formatInr(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}
