import logging
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

MAX_WIDTH = 600


async def download_cover(
    cover_url: str, media_type: str, item_id: str
) -> str | None:
    """Download a cover image, resize to max 600px wide, and save as JPEG.

    Returns the relative path like "book/{item_id}.jpg", or None on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(cover_url)
            if resp.status_code != 200:
                logger.warning(
                    f"Cover download failed ({resp.status_code}): {cover_url}"
                )
                return None

            image_data = resp.content
            if not image_data:
                return None

        # Resize with Pillow
        img = Image.open(BytesIO(image_data))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        if img.width > MAX_WIDTH:
            ratio = MAX_WIDTH / img.width
            new_height = int(img.height * ratio)
            img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

        # Save to disk
        output_dir = Path(settings.COVERS_DIR) / media_type
        output_dir.mkdir(parents=True, exist_ok=True)

        output_path = output_dir / f"{item_id}.jpg"
        img.save(str(output_path), "JPEG", quality=85)

        relative_path = f"{media_type}/{item_id}.jpg"
        return relative_path

    except Exception as e:
        logger.warning(f"Cover art processing failed for {cover_url}: {e}")
        return None
