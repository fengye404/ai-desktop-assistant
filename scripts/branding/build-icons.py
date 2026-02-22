#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

try:
  from PIL import Image, ImageOps
except ImportError as exc:
  raise SystemExit(
    '[branding] Pillow is required. Install it with: python3 -m pip install Pillow'
  ) from exc

ROOT_DIR = Path(__file__).resolve().parents[2]

SOURCE_ICON_PATH = ROOT_DIR / 'branding' / 'source' / 'app-icon.png'
RENDERER_ICON_PATH = ROOT_DIR / 'src' / 'renderer' / 'public' / 'branding' / 'app-icon.png'
DESKTOP_SOURCE_COPY_PATH = ROOT_DIR / 'public' / 'branding' / 'app-icon.png'
DESKTOP_ICON_PNG_PATH = ROOT_DIR / 'public' / 'branding' / 'app-icon-desktop.png'
DESKTOP_ICON_ICO_PATH = ROOT_DIR / 'public' / 'branding' / 'icon.ico'
DESKTOP_ICON_ICNS_PATH = ROOT_DIR / 'public' / 'branding' / 'icon.icns'
ICONSET_SOURCE_ICON_NAME = 'AppIcon'
ICONSET_SOURCE_PNG_NAME = 'icon_512x512@2x.png'
ICON_CANVAS_SIZE = 1024

# Native apps that use the standard macOS container metrics.
MACOS_ICON_CAR_CANDIDATES = [
  Path('/System/Applications/App Store.app/Contents/Resources/Assets.car'),
  Path('/System/Applications/Notes.app/Contents/Resources/Assets.car'),
  Path('/System/Applications/Calendar.app/Contents/Resources/Assets.car'),
  Path('/System/Applications/Music.app/Contents/Resources/Assets.car'),
  Path('/System/Applications/Photos.app/Contents/Resources/Assets.car'),
]

# Native apps that provide rendered icon alpha with rounded corners.
MACOS_ICON_ICNS_CANDIDATES = [
  Path('/System/Applications/App Store.app/Contents/Resources/AppIcon.icns'),
  Path('/System/Applications/Notes.app/Contents/Resources/AppIcon.icns'),
  Path('/System/Applications/Music.app/Contents/Resources/AppIcon.icns'),
  Path('/System/Applications/Photos.app/Contents/Resources/AppIcon.icns'),
  Path('/System/Applications/Preview.app/Contents/Resources/AppIcon.icns'),
]


def build_desktop_icon_with_mask(source: Image.Image, mask: Image.Image) -> Image.Image:
  icon_content = ImageOps.fit(
    source.convert('RGBA'),
    (ICON_CANVAS_SIZE, ICON_CANVAS_SIZE),
    method=Image.Resampling.LANCZOS,
  )

  rounded_content = Image.new('RGBA', (ICON_CANVAS_SIZE, ICON_CANVAS_SIZE), (0, 0, 0, 0))
  rounded_content.paste(icon_content, (0, 0), mask)
  return rounded_content


def extract_iconset_from_assets_car(
  iconutil_path: str,
  car_path: Path,
) -> tuple[tempfile.TemporaryDirectory[str], Path]:
  temp_dir = tempfile.TemporaryDirectory(prefix='branding-icon-mask-car-')
  iconset_dir = Path(temp_dir.name) / 'AppIcon.iconset'
  extraction_command = [
    iconutil_path,
    '-c',
    'iconset',
    str(car_path),
    ICONSET_SOURCE_ICON_NAME,
    '-o',
    str(iconset_dir),
  ]
  subprocess.run(
    extraction_command,
    check=True,
    capture_output=True,
    text=True,
  )
  return temp_dir, iconset_dir


def load_macos_container_bbox(iconutil_path: str) -> tuple[tuple[int, int, int, int], Path]:
  extraction_errors: list[str] = []

  for car_path in MACOS_ICON_CAR_CANDIDATES:
    if not car_path.exists():
      extraction_errors.append(f'{car_path}: missing')
      continue

    try:
      temp_dir, iconset_dir = extract_iconset_from_assets_car(iconutil_path, car_path)
    except subprocess.CalledProcessError as exc:
      reason = (exc.stderr or exc.stdout or '').strip() or 'iconutil failed'
      extraction_errors.append(f'{car_path}: {reason}')
      continue

    try:
      mask_source_path = iconset_dir / ICONSET_SOURCE_PNG_NAME
      if not mask_source_path.exists():
        extraction_errors.append(f'{car_path}: missing {ICONSET_SOURCE_PNG_NAME}')
        continue

      mask = Image.open(mask_source_path).convert('RGBA').getchannel('A')
      if mask.size != (ICON_CANVAS_SIZE, ICON_CANVAS_SIZE):
        mask = mask.resize((ICON_CANVAS_SIZE, ICON_CANVAS_SIZE), Image.Resampling.LANCZOS)

      bbox = mask.getbbox()
      if bbox is None:
        extraction_errors.append(f'{car_path}: extracted alpha mask is empty')
        continue

      return bbox, car_path
    finally:
      temp_dir.cleanup()

  formatted_errors = '\n'.join(f'  - {message}' for message in extraction_errors)
  raise RuntimeError(
    '[branding] failed to extract macOS container bbox from native Assets.car files.\n'
    f'{formatted_errors}'
  )


def extract_iconset_from_icns(
  iconutil_path: str,
  icns_path: Path,
) -> tuple[tempfile.TemporaryDirectory[str], Path]:
  temp_dir = tempfile.TemporaryDirectory(prefix='branding-icon-mask-icns-')
  iconset_dir = Path(temp_dir.name) / 'AppIcon.iconset'
  extraction_command = [
    iconutil_path,
    '-c',
    'iconset',
    str(icns_path),
    '-o',
    str(iconset_dir),
  ]
  subprocess.run(
    extraction_command,
    check=True,
    capture_output=True,
    text=True,
  )
  return temp_dir, iconset_dir


def select_largest_icon_png(iconset_dir: Path) -> Path | None:
  largest_path: Path | None = None
  largest_area = -1
  for candidate in iconset_dir.glob('*.png'):
    try:
      with Image.open(candidate) as icon_image:
        width, height = icon_image.size
    except OSError:
      continue

    area = width * height
    if area > largest_area:
      largest_area = area
      largest_path = candidate

  return largest_path


def load_macos_rounded_shape_mask(iconutil_path: str) -> tuple[Image.Image, Path]:
  extraction_errors: list[str] = []

  for icns_path in MACOS_ICON_ICNS_CANDIDATES:
    if not icns_path.exists():
      extraction_errors.append(f'{icns_path}: missing')
      continue

    try:
      temp_dir, iconset_dir = extract_iconset_from_icns(iconutil_path, icns_path)
    except subprocess.CalledProcessError as exc:
      reason = (exc.stderr or exc.stdout or '').strip() or 'iconutil failed'
      extraction_errors.append(f'{icns_path}: {reason}')
      continue

    try:
      largest_png = select_largest_icon_png(iconset_dir)
      if largest_png is None:
        extraction_errors.append(f'{icns_path}: no PNG images in extracted iconset')
        continue

      alpha = Image.open(largest_png).convert('RGBA').getchannel('A')
      bbox = alpha.getbbox()
      if bbox is None:
        extraction_errors.append(f'{icns_path}: extracted alpha mask is empty')
        continue

      return alpha, icns_path
    finally:
      temp_dir.cleanup()

  formatted_errors = '\n'.join(f'  - {message}' for message in extraction_errors)
  raise RuntimeError(
    '[branding] failed to extract macOS rounded icon shape from native AppIcon.icns files.\n'
    f'{formatted_errors}'
  )


def reshape_mask_to_bbox(source_alpha: Image.Image, target_bbox: tuple[int, int, int, int]) -> Image.Image:
  source_bbox = source_alpha.getbbox()
  if source_bbox is None:
    raise RuntimeError('[branding] source rounded alpha is empty')

  source_cropped = source_alpha.crop(source_bbox)
  target_x0, target_y0, target_x1, target_y1 = target_bbox
  target_width = target_x1 - target_x0
  target_height = target_y1 - target_y0
  if target_width <= 0 or target_height <= 0:
    raise RuntimeError(f'[branding] invalid target bbox: {target_bbox}')

  resized_shape = source_cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
  output_mask = Image.new('L', (ICON_CANVAS_SIZE, ICON_CANVAS_SIZE), 0)
  output_mask.paste(resized_shape, (target_x0, target_y0))

  # Validate that corners are actually rounded (top-left corner must stay transparent).
  if output_mask.getpixel((target_x0, target_y0)) != 0:
    raise RuntimeError('[branding] rounded shape validation failed: corner is not transparent')

  return output_mask


def load_macos_standard_mask() -> tuple[Image.Image, Path, Path]:
  if sys.platform != 'darwin':
    raise RuntimeError('[branding] macOS standard icon mask extraction requires macOS.')

  iconutil_path = shutil.which('iconutil')
  if iconutil_path is None:
    raise RuntimeError('[branding] iconutil is missing, cannot extract macOS standard icon mask.')

  container_bbox, container_source = load_macos_container_bbox(iconutil_path)
  rounded_shape_alpha, rounded_shape_source = load_macos_rounded_shape_mask(iconutil_path)
  mask = reshape_mask_to_bbox(rounded_shape_alpha, container_bbox)
  return mask, container_source, rounded_shape_source


def build_icons_from_source(source_path: Path) -> tuple[Path, Path]:
  RENDERER_ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
  DESKTOP_ICON_PNG_PATH.parent.mkdir(parents=True, exist_ok=True)

  # Keep renderer and source-copy PNG assets as exact source bytes.
  shutil.copyfile(source_path, RENDERER_ICON_PATH)
  shutil.copyfile(source_path, DESKTOP_SOURCE_COPY_PATH)

  source = Image.open(source_path).convert('RGBA')
  standard_mask, container_source, rounded_shape_source = load_macos_standard_mask()
  rounded_desktop_icon = build_desktop_icon_with_mask(source, standard_mask)
  rounded_desktop_icon.save(DESKTOP_ICON_PNG_PATH, format='PNG')

  rounded_desktop_icon.save(
    DESKTOP_ICON_ICO_PATH,
    format='ICO',
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
  )
  rounded_desktop_icon.save(DESKTOP_ICON_ICNS_PATH, format='ICNS')
  return container_source, rounded_shape_source


def main() -> None:
  if not SOURCE_ICON_PATH.exists():
    raise SystemExit(f'[branding] source icon missing: {SOURCE_ICON_PATH}')

  print(f'[branding] using source icon: {SOURCE_ICON_PATH}')

  container_source, rounded_shape_source = build_icons_from_source(SOURCE_ICON_PATH)
  print(f'[branding] updated renderer icon: {RENDERER_ICON_PATH}')
  print(f'[branding] updated desktop source copy png: {DESKTOP_SOURCE_COPY_PATH}')
  print(f'[branding] updated desktop rounded icon png: {DESKTOP_ICON_PNG_PATH}')
  print(f'[branding] updated desktop icon ico: {DESKTOP_ICON_ICO_PATH}')
  print(f'[branding] updated desktop icon icns: {DESKTOP_ICON_ICNS_PATH}')
  print(f'[branding] macOS container bbox source: {container_source}')
  print(f'[branding] macOS rounded-shape source: {rounded_shape_source}')


if __name__ == '__main__':
  main()
