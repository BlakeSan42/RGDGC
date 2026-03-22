"""
File upload service for RGDGC.

Supports two backends:
- local: saves to backend/uploads/ directory (development)
- s3: saves to S3/R2 bucket (production)
"""

import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import get_settings

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# Resolve uploads dir relative to this file -> backend/uploads/
UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


def _get_extension(filename: str) -> str:
    """Extract lowercase extension from a filename."""
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def _validate_file(file: UploadFile) -> None:
    """Validate file type and size. Raises HTTPException on failure."""
    settings = get_settings()

    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid file type '{file.content_type}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Validate extension
    ext = _get_extension(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid file extension '.{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Validate size (read and check length)
    # Note: size checking is done after reading the file content in upload_file()
    _ = settings.upload_max_size  # ensure setting exists


def _generate_filename(original_filename: str, custom_name: str | None = None) -> str:
    """Generate a unique filename preserving the original extension."""
    ext = _get_extension(original_filename or "unknown.jpg")
    if not ext:
        ext = "jpg"
    base = custom_name if custom_name else uuid.uuid4().hex
    return f"{base}.{ext}"


async def upload_file(
    file: UploadFile,
    folder: str,
    filename: str | None = None,
) -> str:
    """
    Upload a file and return its public URL.

    Args:
        file: The uploaded file.
        folder: Subdirectory to store in (e.g. "avatars", "discs").
        filename: Optional custom filename (without extension). If None, UUID is generated.

    Returns:
        Public URL string for the uploaded file.
    """
    _validate_file(file)
    settings = get_settings()

    # Read file content
    content = await file.read()

    # Check size after reading
    if len(content) > settings.upload_max_size:
        max_mb = settings.upload_max_size / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {max_mb:.0f}MB.",
        )

    generated_name = _generate_filename(file.filename or "upload.jpg", filename)

    if settings.storage_backend == "s3":
        return await _upload_s3(content, folder, generated_name, file.content_type)
    else:
        return await _upload_local(content, folder, generated_name)


async def _upload_local(content: bytes, folder: str, filename: str) -> str:
    """Save file to local filesystem and return URL path."""
    dest_dir = UPLOADS_DIR / folder
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_path = dest_dir / filename
    dest_path.write_bytes(content)

    return f"/uploads/{folder}/{filename}"


async def _upload_s3(
    content: bytes, folder: str, filename: str, content_type: str | None
) -> str:
    """Upload file to S3/R2 and return full URL."""
    import boto3
    from botocore.config import Config as BotoConfig

    settings = get_settings()

    client_kwargs: dict = {
        "service_name": "s3",
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
    }
    if settings.s3_endpoint:
        client_kwargs["endpoint_url"] = settings.s3_endpoint
        client_kwargs["config"] = BotoConfig(signature_version="s3v4")

    s3 = boto3.client(**client_kwargs)

    key = f"{folder}/{filename}"
    extra_args: dict = {}
    if content_type:
        extra_args["ContentType"] = content_type
    extra_args["ACL"] = "public-read"

    s3.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=content,
        **extra_args,
    )

    # Build public URL
    if settings.s3_endpoint:
        # R2 / custom endpoint: https://pub-xxx.r2.dev/folder/file
        # Use bucket subdomain style
        base = settings.s3_endpoint.rstrip("/")
        return f"{base}/{settings.s3_bucket}/{key}"
    else:
        return f"https://{settings.s3_bucket}.s3.{settings.s3_region}.amazonaws.com/{key}"


async def delete_file(url: str) -> bool:
    """
    Delete a previously uploaded file.

    Args:
        url: The URL returned by upload_file.

    Returns:
        True if deleted, False if not found or failed.
    """
    settings = get_settings()

    if settings.storage_backend == "s3":
        return await _delete_s3(url)
    else:
        return await _delete_local(url)


async def _delete_local(url: str) -> bool:
    """Delete a file from local uploads directory."""
    if not url.startswith("/uploads/"):
        return False

    relative = url[len("/uploads/"):]
    file_path = UPLOADS_DIR / relative

    if file_path.exists():
        file_path.unlink()
        return True
    return False


async def _delete_s3(url: str) -> bool:
    """Delete a file from S3/R2."""
    import boto3
    from botocore.config import Config as BotoConfig

    settings = get_settings()

    # Extract key from URL
    # Could be https://bucket.s3.region.amazonaws.com/folder/file
    # or https://endpoint/bucket/folder/file
    key = None
    if settings.s3_endpoint:
        prefix = f"{settings.s3_endpoint.rstrip('/')}/{settings.s3_bucket}/"
        if url.startswith(prefix):
            key = url[len(prefix):]
    else:
        prefix = f"https://{settings.s3_bucket}.s3.{settings.s3_region}.amazonaws.com/"
        if url.startswith(prefix):
            key = url[len(prefix):]

    if not key:
        return False

    client_kwargs: dict = {
        "service_name": "s3",
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
    }
    if settings.s3_endpoint:
        client_kwargs["endpoint_url"] = settings.s3_endpoint
        client_kwargs["config"] = BotoConfig(signature_version="s3v4")

    s3 = boto3.client(**client_kwargs)

    try:
        s3.delete_object(Bucket=settings.s3_bucket, Key=key)
        return True
    except Exception:
        return False


async def get_upload_url(folder: str, filename: str) -> str:
    """
    Generate a presigned upload URL (S3 only).

    For local backend, raises an error since presigned URLs are not applicable.

    Args:
        folder: Subdirectory (e.g. "avatars").
        filename: Target filename.

    Returns:
        Presigned PUT URL valid for 1 hour.
    """
    settings = get_settings()

    if settings.storage_backend != "s3":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Presigned URLs are only available with S3 storage backend.",
        )

    import boto3
    from botocore.config import Config as BotoConfig

    client_kwargs: dict = {
        "service_name": "s3",
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
    }
    if settings.s3_endpoint:
        client_kwargs["endpoint_url"] = settings.s3_endpoint
        client_kwargs["config"] = BotoConfig(signature_version="s3v4")

    s3 = boto3.client(**client_kwargs)

    key = f"{folder}/{filename}"
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=3600,
    )
    return url
