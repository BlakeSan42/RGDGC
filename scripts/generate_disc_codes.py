#!/usr/bin/env python3
"""
RGDGC Disc Code Generator

Generates unique disc codes for sticker printing.
Output can be used directly with Avery Design & Print mail merge.

Usage:
    python generate_disc_codes.py --count 100 --output disc_codes.csv
    python generate_disc_codes.py --count 50 --output batch_march_2026.csv --batch-name "Spring League 2026"
"""

import argparse
import csv
import random
import string
import json
import qrcode
import qrcode.image.svg
from pathlib import Path
from datetime import datetime
import io
import base64


def generate_code(prefix: str = "RGDG") -> str:
    """Generate a single disc code like RGDG-A1B2."""
    chars = string.ascii_uppercase + string.digits
    # Remove confusing characters (0, O, 1, I, L)
    chars = chars.replace('0', '').replace('O', '').replace('1', '').replace('I', '').replace('L', '')
    suffix = ''.join(random.choices(chars, k=4))
    return f"{prefix}-{suffix}"


def generate_qr_svg(url: str) -> str:
    """Generate QR code as SVG string."""
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    factory = qrcode.image.svg.SvgImage
    img = qr.make_image(image_factory=factory)
    
    buffer = io.BytesIO()
    img.save(buffer)
    return buffer.getvalue().decode('utf-8')


def generate_qr_png_base64(url: str) -> str:
    """Generate QR code as PNG base64 string."""
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def generate_batch(
    count: int,
    prefix: str = "RGDG",
    base_url: str = "https://disc.rgdgc.com",
    include_qr_images: bool = False
) -> list[dict]:
    """Generate a batch of unique disc codes."""
    codes = set()
    results = []
    
    # Generate unique codes
    attempts = 0
    while len(codes) < count and attempts < count * 10:
        code = generate_code(prefix)
        if code not in codes:
            codes.add(code)
        attempts += 1
    
    if len(codes) < count:
        raise ValueError(f"Could not generate {count} unique codes")
    
    # Build results
    for code in sorted(codes):
        url = f"{base_url}/{code}"
        entry = {
            "code": code,
            "url": url,
            "short_url": code,  # For display on sticker
        }
        
        if include_qr_images:
            entry["qr_svg"] = generate_qr_svg(url)
            entry["qr_png_base64"] = generate_qr_png_base64(url)
        
        results.append(entry)
    
    return results


def save_csv(codes: list[dict], filepath: str, include_images: bool = False):
    """Save codes to CSV file for Avery mail merge."""
    fieldnames = ["code", "url", "short_url"]
    if include_images:
        fieldnames.extend(["qr_png_base64"])
    
    with open(filepath, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(codes)
    
    print(f"✓ Saved {len(codes)} codes to {filepath}")


def save_json(codes: list[dict], filepath: str):
    """Save codes to JSON file for API import."""
    with open(filepath, 'w') as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "count": len(codes),
            "codes": codes
        }, f, indent=2)
    
    print(f"✓ Saved {len(codes)} codes to {filepath}")


def save_qr_images(codes: list[dict], output_dir: str):
    """Save individual QR code images for each disc."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    for entry in codes:
        # SVG
        svg_path = output_path / f"{entry['code']}.svg"
        with open(svg_path, 'w') as f:
            f.write(generate_qr_svg(entry['url']))
        
        # PNG (from base64)
        png_path = output_path / f"{entry['code']}.png"
        png_data = base64.b64decode(generate_qr_png_base64(entry['url']))
        with open(png_path, 'wb') as f:
            f.write(png_data)
    
    print(f"✓ Saved {len(codes)} QR images to {output_dir}/")


def main():
    parser = argparse.ArgumentParser(description="Generate RGDGC disc codes for sticker printing")
    parser.add_argument("--count", "-n", type=int, default=100, help="Number of codes to generate")
    parser.add_argument("--output", "-o", type=str, default="disc_codes.csv", help="Output CSV file")
    parser.add_argument("--prefix", type=str, default="RGDG", help="Code prefix (default: RGDG)")
    parser.add_argument("--base-url", type=str, default="https://disc.rgdgc.com", help="Base URL for QR codes")
    parser.add_argument("--batch-name", type=str, help="Optional batch name for tracking")
    parser.add_argument("--json", action="store_true", help="Also output JSON file")
    parser.add_argument("--images", action="store_true", help="Generate individual QR code images")
    parser.add_argument("--images-dir", type=str, default="qr_codes", help="Directory for QR images")
    
    args = parser.parse_args()
    
    print(f"\n🥏 RGDGC Disc Code Generator")
    print(f"   Generating {args.count} codes...")
    
    if args.batch_name:
        print(f"   Batch: {args.batch_name}")
    
    # Generate codes
    codes = generate_batch(
        count=args.count,
        prefix=args.prefix,
        base_url=args.base_url,
        include_qr_images=args.images
    )
    
    # Save CSV (for Avery mail merge)
    save_csv(codes, args.output, include_images=args.images)
    
    # Save JSON (for API import)
    if args.json:
        json_path = args.output.replace('.csv', '.json')
        save_json(codes, json_path)
    
    # Save QR images
    if args.images:
        save_qr_images(codes, args.images_dir)
    
    # Print summary
    print(f"\n📋 Summary:")
    print(f"   First code: {codes[0]['code']}")
    print(f"   Last code:  {codes[-1]['code']}")
    print(f"   Total: {len(codes)} codes")
    print(f"\n📝 Next steps:")
    print(f"   1. Go to avery.com/software/design-and-print")
    print(f"   2. Enter product number: 94506 (1.5\" round waterproof)")
    print(f"   3. Import {args.output} for mail merge")
    print(f"   4. Map 'url' column to QR code content")
    print(f"   5. Map 'code' column to text display")
    print(f"   6. Print and distribute!")


if __name__ == "__main__":
    main()
