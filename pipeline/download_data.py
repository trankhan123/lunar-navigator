"""Download every file listed in DATA_SOURCES.md section 1. Skips files already downloaded."""
from pathlib import Path

import rasterio
import requests

from common import PROJECT_ROOT

MAX_ATTEMPTS = 5


def read_download_table():
    """Return (file name, url, destination folder) for each row of the section 1 table."""
    text = (PROJECT_ROOT / "DATA_SOURCES.md").read_text(encoding="utf-8")
    section_one = text.split("## 1.")[1].split("## 2.")[0]
    rows = []
    for line in section_one.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) >= 3 and cells[1].startswith("http"):
            rows.append((cells[0], cells[1], PROJECT_ROOT / cells[2]))
    return rows


def download(url, target_path):
    expected_size = int(requests.head(url, allow_redirects=True, timeout=60).headers.get("Content-Length", -1))
    if expected_size < 0:
        raise RuntimeError(f"{url}: server sent no Content-Length, cannot verify the download")
    if target_path.exists() and target_path.stat().st_size == expected_size:
        print(f"skip   {target_path.name} (already downloaded)")
        return
    target_path.parent.mkdir(parents=True, exist_ok=True)
    partial_path = target_path.with_suffix(target_path.suffix + ".part")
    # PGDA sometimes resets long connections, so retry and resume from the partial file (server supports Range).
    for attempt in range(1, MAX_ATTEMPTS + 1):
        downloaded_size = partial_path.stat().st_size if partial_path.exists() else 0
        if downloaded_size == expected_size:
            break
        headers = {"Range": f"bytes={downloaded_size}-"} if downloaded_size else {}
        try:
            with requests.get(url, headers=headers, stream=True, timeout=60) as response:
                response.raise_for_status()
                resuming = response.status_code == 206
                with open(partial_path, "ab" if resuming else "wb") as output:
                    for chunk in response.iter_content(chunk_size=1 << 20):
                        output.write(chunk)
            break
        except requests.exceptions.RequestException as error:
            if attempt == MAX_ATTEMPTS:
                raise
            print(f"retry  {target_path.name} (attempt {attempt} failed: {type(error).__name__})")
    if partial_path.stat().st_size != expected_size:
        raise RuntimeError(f"{target_path.name}: got {partial_path.stat().st_size} bytes, expected {expected_size}")
    partial_path.rename(target_path)
    print(f"done   {target_path.name} ({expected_size / 1e6:.0f} MB)")


def describe_raster(path):
    with rasterio.open(path) as raster:
        print(f"check  {path.name}: {raster.width}x{raster.height}, {raster.res[0]:.0f} m/px, dtype {raster.dtypes[0]}")


if __name__ == "__main__":
    rows = read_download_table()
    assert rows, "No download rows found in DATA_SOURCES.md section 1"
    for file_name, url, folder in rows:
        download(url, folder / file_name)
        if file_name.upper().endswith(".TIF"):
            describe_raster(folder / file_name)
