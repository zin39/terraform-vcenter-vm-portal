use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::Rng;

const NONCE_SIZE: usize = 12;

/// Encrypt a plaintext string using AES-256-GCM
/// Returns base64 encoded string containing nonce + ciphertext
pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("Invalid key: {}", e))?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine nonce + ciphertext and encode as base64
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);

    Ok(BASE64.encode(combined))
}

/// Decrypt a base64 encoded string (nonce + ciphertext) using AES-256-GCM
pub fn decrypt(encrypted: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("Invalid key: {}", e))?;

    // Decode base64
    let combined = BASE64
        .decode(encrypted)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    if combined.len() < NONCE_SIZE {
        return Err("Encrypted data too short".to_string());
    }

    // Split nonce and ciphertext
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}

/// Derive a 32-byte key from a string (for use with environment variable)
pub fn derive_key(secret: &str) -> [u8; 32] {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut key = [0u8; 32];
    let secret_bytes = secret.as_bytes();

    // Simple key derivation - in production, use a proper KDF like PBKDF2 or Argon2
    for i in 0..32 {
        let mut hasher = DefaultHasher::new();
        secret_bytes.hash(&mut hasher);
        (i as u64).hash(&mut hasher);
        let hash = hasher.finish();
        key[i] = (hash & 0xFF) as u8;
    }

    key
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = derive_key("test-secret-key");
        let plaintext = "my-secret-password";

        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();

        assert_eq!(plaintext, decrypted);
    }
}
