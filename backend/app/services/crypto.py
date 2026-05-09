import base64
import hashlib
import os


def aes_gcm_encrypt(plaintext: str, password: str) -> str:
    """Encrypt plaintext with password using AES-256-GCM.

    Returns base64-encoded string: salt(16) + iv(12) + ciphertext + tag(16).
    """
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    iv = os.urandom(12)

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(iv, plaintext.encode(), None)

    return base64.b64encode(salt + iv + ct).decode()
