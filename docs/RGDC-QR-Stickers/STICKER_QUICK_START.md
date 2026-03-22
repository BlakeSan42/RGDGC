# RGDGC Disc Stickers: Practical Implementation Guide

## The Simple Truth

Getting unique QR code stickers is simpler than it sounds. Here are 3 real options ranked by practicality:

---

## Option 1: DIY Club Printing (RECOMMENDED TO START)

**Total Cost: ~$35 for 200 stickers**
**Time to First Sticker: 1 hour**
**Difficulty: Easy**

### What You Need

1. **Avery 94506 Labels** - 1.5" round, waterproof vinyl
   - $22 for 100 sheets (2,000 labels) at avery.com
   - Or buy 10 sheets ($8) to test first
   
2. **Any Inkjet or Laser Printer**
   - Home printer works fine
   
3. **Your Phone/Computer**
   - To generate QR codes

### Step-by-Step Process

**Step 1: Generate Disc Codes (5 minutes)**

Go to the RGDGC app admin panel → Stickers → Generate Batch

Or use this simple script:
```python
# generate_codes.py
import csv
import random
import string

def generate_code():
    chars = string.ascii_uppercase + string.digits
    return f"RGDG-{''.join(random.choices(chars, k=4))}"

# Generate 100 unique codes
codes = []
for i in range(100):
    code = generate_code()
    codes.append({
        'code': code,
        'url': f'https://disc.rgdgc.com/{code}'
    })

# Save to CSV
with open('disc_codes.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['code', 'url'])
    writer.writeheader()
    writer.writerows(codes)

print("Generated 100 codes → disc_codes.csv")
```

**Step 2: Create Label Design in Avery (10 minutes)**

1. Go to avery.com/software/design-and-print
2. Enter product number: **94506**
3. Click "Start Designing"
4. Choose blank template
5. Click "Import Data" → Upload your `disc_codes.csv`
6. Add a QR code element:
   - Click QR Code tool
   - Select "Spreadsheet" as data source
   - Map the `url` column to QR content
7. Add text elements:
   - "SCAN IF FOUND" (top)
   - "RGDGC" (bottom)
   - Drag `code` field to show disc code
8. Preview → each label shows unique QR code
9. Download PDF

**Step 3: Print (5 minutes)**

1. Load Avery vinyl labels in printer
2. Print settings: "Best Quality", 100% scale
3. Print the PDF
4. Let dry 2-3 minutes

**Step 4: Distribute**

- Give stickers to members at league events
- They scan with their phone → claims the code to their account
- They apply sticker to disc underside

### Cost Breakdown

| Item | Cost | Labels |
|------|------|--------|
| 10 sheets Avery 94506 | $8 | 200 labels |
| 25 sheets Avery 94506 | $13 | 500 labels |
| 100 sheets Avery 94506 | $22 | 2,000 labels |

**Per-sticker cost: ~$0.01-0.04**

---

## Option 2: Avery WePrint (Professional Quality)

**Total Cost: ~$50-100 for 200 stickers**
**Time to First Sticker: 5-7 days**
**Difficulty: Easy**

### When to Use This

- You want professional print quality
- You need 200+ stickers
- You want waterproof vinyl with clear overlaminate
- You don't want to print yourself

### Process

1. Generate your CSV of codes (same as Option 1)
2. Go to avery.com/custom-printing
3. Select "QR Code Labels"
4. Choose 1.5" round, waterproof vinyl
5. Upload your design + CSV for mail merge
6. Avery prints each label with unique QR code
7. Ships in 5-7 days

### Pricing

| Quantity | Approx. Cost | Per Label |
|----------|--------------|-----------|
| 100 | ~$40 | $0.40 |
| 250 | ~$70 | $0.28 |
| 500 | ~$100 | $0.20 |

---

## Option 3: Variable Data Print Shop

**Total Cost: ~$150-300 for 250 stickers**
**Time to First Sticker: 7-14 days**
**Difficulty: Medium**

### When to Use This

- You need special materials (glow-in-dark, holographic)
- You need 500+ stickers
- You need roll labels for easy application

### Vendors

| Vendor | Specialty | Contact |
|--------|-----------|---------|
| Midwest Label Supply | Serialized QR, enterprise | midwestlabelsupply.com |
| StickerYou | Variable data rolls | stickeryou.com |
| CustomStickers.com | Glow vinyl option | customstickers.com |

### Process

1. Generate CSV of codes
2. Create design file (AI/PDF) with placeholder for QR
3. Email vendor with specs:
   - Quantity: 250
   - Size: 1.5" circle
   - Material: Waterproof vinyl (or glow-in-dark)
   - Variable data: Unique QR from CSV
4. Approve proof
5. Receive stickers

---

## Glow-in-the-Dark Option

For night golf (Glow Dubs), you want stickers that glow so players can find their discs.

### DIY Glow Stickers

**Product:** Hayes Paper Glow-in-the-Dark Vinyl (Amazon, ~$15 for 5 sheets)

1. Print QR codes on glow vinyl using inkjet
2. Cut with scissors or Cricut
3. Apply to disc

**Note:** QR codes printed on glow material may be harder to scan due to lower contrast. Test first!

### Better Approach for Night Golf

Use **regular white stickers with glow ring**:
1. Apply white QR sticker to disc center
2. Apply separate glow ring sticker around it
3. Glow ring helps find disc; white QR scans perfectly

Or buy glow-in-dark disc tape separately (Amazon, ~$8/roll) and apply around the sticker.

---

## How the Database + Blockchain Works

### Phase 1: Database Only (Launch)

```
┌─────────────────────────────────────────────────────┐
│ 1. ADMIN GENERATES CODES                            │
│    └─→ CSV: RGDG-A1B2, RGDG-C3D4, RGDG-E5F6...     │
│                                                     │
│ 2. ADMIN PRINTS STICKERS                            │
│    └─→ Each sticker has unique QR                   │
│                                                     │
│ 3. MEMBER RECEIVES STICKER AT EVENT                 │
│    └─→ Scans QR with phone                          │
│    └─→ Logs in / Creates account                    │
│    └─→ Code linked to their account                 │
│                                                     │
│ 4. MEMBER ADDS DISC DETAILS                         │
│    └─→ Innova Destroyer, Blue, 175g                 │
│    └─→ Uploads photo                                │
│                                                     │
│ 5. MEMBER APPLIES STICKER TO DISC                   │
│    └─→ Center underside, clean surface              │
│                                                     │
│ 6. DISC IS NOW TRACKED                              │
│    └─→ Lost? Mark in app                            │
│    └─→ Found? Scan QR → Contact owner               │
└─────────────────────────────────────────────────────┘
```

**Database stores:**
- disc_code (e.g., "RGDG-A1B2")
- owner_id (links to user)
- manufacturer, mold, plastic, weight, color
- photo_url
- status (active, lost, found, returned)
- blockchain_token_id (null until minted)

### Phase 2: Optional Blockchain (Later)

For members who want provenance/collectibility:

```
Member clicks "Mint to Blockchain" → pays $0.05 in $RGDG or ETH
→ Smart contract creates NFT on Polygon
→ NFT metadata stored on IPFS
→ Database updated with token_id
→ Disc now has verifiable on-chain ownership
```

**When blockchain matters:**
- Selling a disc (proves authenticity)
- Collectible/rare discs (provenance)
- Finder rewards (auto-paid via smart contract)

**When database is enough:**
- Normal disc tracking
- Lost/found coordination
- Stats and history

---

## Quick Start Checklist

### Today (30 minutes)
- [ ] Buy Avery 94506 labels (10 sheets = $8, 200 stickers)
- [ ] Generate 50 disc codes using script
- [ ] Create design in Avery Design & Print
- [ ] Print 1 test sheet
- [ ] Scan QR codes to verify they work

### This Week
- [ ] Print full batch of stickers
- [ ] Update app to handle sticker claiming
- [ ] Distribute stickers at next league event

### Next Month
- [ ] Order professional batch if DIY working well
- [ ] Consider glow-in-dark for Glow Dubs events
- [ ] Add blockchain minting option

---

## Sticker Application Instructions (For Members)

Include this on a card with each sticker:

```
╔══════════════════════════════════════════╗
║     RGDGC DISC REGISTRATION STICKER      ║
╠══════════════════════════════════════════╣
║                                          ║
║  1. SCAN the QR code with your phone     ║
║                                          ║
║  2. LOG IN or create an RGDGC account    ║
║                                          ║
║  3. ADD your disc details                ║
║     (manufacturer, mold, color)          ║
║                                          ║
║  4. APPLY sticker to disc underside      ║
║     - Clean surface first                ║
║     - Center of flight plate             ║
║     - Press firmly for 30 seconds        ║
║                                          ║
║  IF LOST: Mark as lost in the app        ║
║  IF FOUND: Scanner can contact you!      ║
║                                          ║
║         disc.rgdgc.com                   ║
╚══════════════════════════════════════════╝
```

---

## Files Needed

### 1. Code Generation Script
`/home/claude/rgdgc-app/scripts/generate_disc_codes.py`

### 2. Sticker Design Template
`/home/claude/rgdgc-app/assets/sticker_template.svg`

### 3. Backend Endpoints
- `POST /api/v1/stickers/generate-batch` - Generate codes (admin)
- `POST /api/v1/stickers/claim/{code}` - Claim a sticker code
- `GET /api/v1/discs/{code}/lookup` - Public lookup (QR scan)

---

## FAQ

**Q: Can I use my own printer?**
A: Yes! Any inkjet or laser printer works with Avery labels.

**Q: Will the sticker survive rain/water?**
A: Yes, Avery waterproof vinyl is rated for outdoor use.

**Q: What if someone peels off my sticker?**
A: The disc is still registered to you in the database. You can print a replacement sticker for the same code.

**Q: Do I need blockchain?**
A: No. The database handles 99% of use cases. Blockchain is optional for collectibility and automated rewards.

**Q: What size sticker?**
A: 1.5" round fits perfectly on disc undersides without affecting flight.

**Q: How long do stickers last?**
A: Avery vinyl labels are rated for 2+ years outdoor use.
