from pathlib import Path

UPLOAD_DIR: Path = Path(__file__).resolve().parent.parent / "uploads"
MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
ALLOWED_AUDIO_EXTENSIONS: set[str] = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".webm", ".aac", ".wma"}
MODEL_SAMPLE_RATE: int = 22050  # basic-pitch / CREPE expected SR
