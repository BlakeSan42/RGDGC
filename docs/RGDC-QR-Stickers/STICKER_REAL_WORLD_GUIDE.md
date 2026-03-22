# RGDGC Disc Stickers: Real-World Production Guide

## The Bottom Line

After research, here's the reality:

1. **Glow-in-the-dark printable vinyl EXISTS** and works with home inkjet printers
2. **BUT** printing a QR code on glow material creates a contrast problem - the greenish tint of glow vinyl reduces QR scannability
3. **Professional glow sticker printers** solve this with proper lamination and high-contrast printing
4. **Best practical approach:** Order custom glow stickers from a vendor, OR use a two-sticker system (white QR + glow ring)

---

## Option 1: Order Custom Glow QR Stickers from a Vendor

**This is the recommended approach for quality + reliability.**

### Vendors That Print Variable QR Codes on Glow Vinyl

| Vendor | Min Order | Turnaround | Approx Cost | Notes |
|--------|-----------|------------|-------------|-------|
| **CustomStickers.com** | 1 sticker | 5-7 days | ~$3-5/ea at low qty | Waterproof, UV-resistant, 5-year outdoor life |
| **StickerGiant** | 10 stickers | 3-4 weeks | ~$2-4/ea | High quality, laminated, water resistant |
| **StickerNinja** | 25 stickers | 5-7 days | ~$1.50-3/ea | Highly rated glow brightness |
| **Busy Beaver Button Co** | 50 stickers | 5-7 days | ~$1.50-2/ea | Laminated vinyl, UV-resistant |
| **Sticker Mule** | Contact | 4-5 days | Quote | Premium quality, no variable data API (manual order) |

### How to Order Variable Data (Unique QR per sticker)

Most of these vendors accept:
1. **A design file** (AI, PDF, or SVG) with a placeholder for the QR code
2. **A CSV/Excel file** with the unique data for each sticker

**Email template:**
```
Subject: Quote for Glow-in-Dark Stickers with Variable QR Codes

Hi,

I need custom glow-in-the-dark stickers with a unique QR code on each one.

Specs:
- Quantity: 250 stickers
- Size: 1.5" diameter circle
- Material: Glow-in-the-dark vinyl with laminate
- Variable data: Unique QR code per sticker (I'll provide CSV)

Each QR code links to a unique URL like:
https://disc.rgdgc.com/RGDG-A1B2

Can you provide a quote and confirm you support variable data printing?

Thanks,
[Name]
```

### Professional Glow Sticker Specs

When ordering, request:
- **Material:** Photoluminescent vinyl with clear matte laminate
- **QR Code Area:** White background behind QR for maximum contrast
- **Lamination:** Matte (reduces glare, better scanning)
- **Adhesive:** Permanent, outdoor-rated
- **Error Correction:** Level H (30% redundancy) for QR codes

---

## Option 2: DIY Printable Glow Vinyl (Home Printer)

### Products Available

| Product | Price | Source | Printer Type | Notes |
|---------|-------|--------|--------------|-------|
| **Hayes Paper Glow Vinyl** | ~$15/5 sheets | Amazon, hayespaper.com | Inkjet only | Most popular, good reviews |
| **A-SUB Glow Vinyl** | ~$14/5 sheets | Amazon, a-sub.com | Inkjet only | Water resistant |
| **TECKWRAP Glow Vinyl** | ~$18/14 sheets | Amazon | Inkjet only | Waterproof, strong adhesive |
| **GIRAFVINYL Glow Vinyl** | ~$13/10 sheets | Amazon | Inkjet & Laser | White turns green |
| **Silhouette Glow Sticker Paper** | ~$8/2 sheets | Amazon, craft stores | Inkjet | Designed for Silhouette cutters |

### The QR Code Problem

**Issue:** Glow-in-the-dark vinyl has a slight green/yellow tint. When you print a black QR code on it:
- Daytime: Works fine, QR scans
- After glowing: The tint can reduce contrast
- When wet/dirty: May struggle to scan

**Solutions:**

1. **Print a white rectangle behind the QR code**
   - Most inkjet printers can't print white
   - You'd need a white vinyl base with glow border

2. **Use HIGH error correction (Level H)** when generating QR codes
   - Survives up to 30% damage/obstruction
   - Makes QR more scannable even with reduced contrast

3. **Make the QR code larger** (at least 1.5" x 1.5")
   - Bigger modules = easier to scan

4. **Apply clear laminate over the sticker**
   - Protects print
   - Seals in the ink
   - Adds durability

### Recommended DIY Setup

**Materials (~$50 total):**
- Hayes Paper Glow Vinyl 5-pack: $15
- Self-adhesive laminate sheets: $12
- Cricut/Silhouette cutter (if you have one) or scissors
- Any inkjet printer (Canon, Epson, HP, Brother)

**Printer Settings:**
- Quality: Best / High / Photo
- Paper Type: Glossy Photo Paper or Vinyl
- Color: Vivid / High Saturation

**Process:**
1. Generate QR codes with Level H error correction
2. Create design with black QR on largest possible white area
3. Print on glow vinyl
4. Let dry 5-10 minutes
5. Apply laminate sheet
6. Cut to shape
7. Test scan before distributing

---

## Option 3: Two-Sticker System (Most Reliable)

**Best of both worlds: Scannable QR + Glow visibility**

### How It Works

Apply TWO stickers to each disc:

1. **Center sticker:** White waterproof vinyl with black QR code
   - Perfect contrast = 100% scannability
   - Use Avery 94506 (1.5" round waterproof vinyl)
   
2. **Glow ring:** Glow-in-the-dark tape or sticker around the QR sticker
   - No printing needed
   - Glows bright green to locate disc at night
   - Products: Techno Glow tape, ORALITE glow tape

### Products for Two-Sticker System

**For the QR sticker:**
| Product | Price | Notes |
|---------|-------|-------|
| Avery 94506 | $8/200 labels | 1.5" round, waterproof vinyl, inkjet/laser |
| Avery 22807 | $12/120 labels | 1.5" round, glossy white, inkjet only |
| OnlineLabels | $15/300 labels | Waterproof white vinyl rounds |

**For the glow ring:**
| Product | Price | Notes |
|---------|-------|-------|
| Techno Glow Tape 1" x 30ft | ~$15 | Cut into rings, strong glow, weatherproof |
| ORALITE V98 Glow Tape | ~$25/roll | Professional grade, 3M adhesive |
| LumAware Glow Tape | ~$12/roll | Good budget option |
| Pre-cut glow rings | ~$0.50/ea | Search "glow in dark ring sticker" on Amazon |

### Assembly

```
        ┌─────────────────────────┐
        │  ░░░ GLOW RING ░░░░░░░  │
        │  ░░                 ░░  │
        │  ░   ┌───────────┐   ░  │
        │  ░   │  ▓▓▓▓▓▓▓  │   ░  │
        │  ░   │  ▓ QR  ▓  │   ░  │
        │  ░   │  ▓CODE ▓  │   ░  │
        │  ░   │  ▓▓▓▓▓▓▓  │   ░  │
        │  ░   └───────────┘   ░  │
        │  ░░                 ░░  │
        │  ░░░░░░░░░░░░░░░░░░░░░  │
        └─────────────────────────┘
        
        Center: 1.5" white QR sticker
        Ring: 0.5" glow tape around edge
        Total diameter: ~2.5"
```

---

## Cost Comparison

| Approach | Setup Cost | Per-Sticker Cost (100 qty) | Scan Reliability | Glow Quality |
|----------|------------|----------------------------|------------------|--------------|
| **Vendor (CustomStickers)** | $0 | ~$2.50-3.00 | ★★★★☆ | ★★★★★ |
| **DIY Glow Vinyl + Laminate** | ~$50 | ~$0.30 | ★★★☆☆ | ★★★★☆ |
| **Two-Sticker System** | ~$25 | ~$0.15 | ★★★★★ | ★★★★★ |
| **Avery White Only (no glow)** | $8 | ~$0.04 | ★★★★★ | None |

---

## Printer Recommendations

If you don't have a printer, here are good options for sticker printing:

### Inkjet (Required for Glow Vinyl)

| Printer | Price | Notes |
|---------|-------|-------|
| **Epson EcoTank ET-2850** | ~$250 | Refillable ink tanks, low per-page cost |
| **Canon PIXMA iP8720** | ~$250 | Wide format, excellent photo quality |
| **HP OfficeJet Pro 8025e** | ~$180 | Good all-around, fast |
| **Brother MFC-J1010DW** | ~$100 | Budget option, works fine |

### Laser (NOT for glow vinyl, but works for regular vinyl)

| Printer | Price | Notes |
|---------|-------|-------|
| **Brother HL-L2350DW** | ~$120 | Fast, cheap per page |
| **HP LaserJet M209dwe** | ~$180 | Reliable, compact |

**Note:** Most glow-in-the-dark vinyl is INKJET ONLY. The heat from laser printers can damage the photoluminescent material.

---

## Recommended Path Forward

### Phase 1: Test (This Week) - $25

1. Buy Avery 94506 waterproof labels ($8)
2. Buy small roll of glow tape ($12)
3. Generate 20 test codes
4. Print QR stickers on Avery labels
5. Apply glow tape ring around each
6. Test at night golf
7. Get feedback from members

### Phase 2: Scale (Next Month) - $150-300

Based on test feedback, either:

**A) Order professional glow QR stickers**
- Contact CustomStickers.com or StickerNinja
- Order 250 stickers with variable QR codes
- Cost: ~$250-400

**B) Continue two-sticker system**
- Order 500 Avery labels ($15)
- Order bulk glow tape ($25)
- Print in batches as needed

### Phase 3: Integrate Blockchain (Month 3+)

- Add optional NFT minting to app
- Finder rewards via smart contract
- Disc provenance tracking

---

## Quick Reference

### Generate QR Codes (Python)

```python
import qrcode

def create_disc_qr(disc_code, output_path):
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # HIGH - 30% recovery
        box_size=20,
        border=4,
    )
    qr.add_data(f"https://disc.rgdgc.com/{disc_code}")
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_path)

# Generate for a batch
codes = ["RGDG-A1B2", "RGDG-C3D4", "RGDG-E5F6"]
for code in codes:
    create_disc_qr(code, f"{code}.png")
```

### Vendor Contact List

| Vendor | Website | Supports Variable QR | Glow Option |
|--------|---------|---------------------|-------------|
| CustomStickers.com | customstickers.com | Yes | Yes |
| StickerNinja | stickerninja.com | Yes (contact) | Yes |
| StickerGiant | stickergiant.com | Yes | Yes |
| Busy Beaver | busybeaver.net | Yes | Yes |
| Midwest Label Supply | midwestlabelsupply.com | Yes (enterprise) | Contact |
| StickerYou | stickeryou.com | Yes | No |

### Material Specs for Disc Golf

- **Size:** 1.5" diameter minimum (larger is better)
- **Material:** Vinyl (not paper)
- **Adhesive:** Permanent, outdoor-rated
- **Finish:** Matte (less glare = better scanning)
- **Durability:** Waterproof, UV-resistant
- **Placement:** Center underside of disc

---

*Last updated: March 2026*
