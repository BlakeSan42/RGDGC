# KSA Ownership, Governance & Political Structure

## River Grove Park — Land Ownership

River Grove Park (74 acres) is **privately owned by the Kingwood Service Association**. It is NOT a public park, NOT county-owned, and NOT MUD-owned.

```mermaid
graph TD
    subgraph "Land Ownership Chain"
        FL[Foster Lumber Company<br/>Original Landowner] -->|"Sold 14,000 acres<br/>Dec 28, 1967"| JV
        JV[Joint Venture:<br/>Friendswood Development Co.<br/>+ King Ranch] -->|"Developed Kingwood<br/>1969-1995"| FDC
        FDC[Friendswood Development Co.<br/>Exxon Subsidiary] -->|"Donated parkland<br/>1971-1994"| KSA
        FDC -->|"Sold for $110M<br/>1995"| LEN[Lennar Corporation<br/>Remaining undeveloped land]
        KSA[Kingwood Service Association<br/>501c4 Non-Profit<br/>CURRENT OWNER]
    end

    style KSA fill:#1B5E20,color:#fff,stroke:#fff
    style FL fill:#666,color:#fff
    style JV fill:#444,color:#fff
    style FDC fill:#444,color:#fff
    style LEN fill:#666,color:#fff
```

### Property Records

- **County:** Harris County, Texas
- **Property Search:** [HCAD Property Search](https://hcad.org/property-search/property-search)
- **Owner of Record:** Kingwood Service Association
- **Location:** South end of Woodland Hills Drive, Kingwood, TX
- **Acreage:** 74 acres
- **Tax Status:** Tax-exempt (501(c)(4) property)

---

## Governance Structure

```mermaid
graph TB
    subgraph "KSA Governance Model"
        RES[Kingwood Residents<br/>~80,000 people] -->|"Pay village HOA dues"| VIL
        VIL[30+ Village HOAs<br/>Individual neighborhood associations] -->|"Appoint representatives<br/>+ pay assessments"| BOD
        BOD[KSA Board of Directors<br/>Volunteer representatives<br/>from member villages] -->|"Sets policy<br/>approves budget"| COM
        COM[Committees<br/>Parks, Public Safety, etc.] -->|"Recommend actions"| BOD
        BOD -->|"Contracts management"| KAM
        KAM[Kingwood Association<br/>Management - KAM<br/>Ethel McCormick] -->|"Operates"| OPS
        OPS[Day-to-Day Operations<br/>Parks, Entryways,<br/>K-Stickers, Security]
    end

    style BOD fill:#1B5E20,color:#fff
    style KAM fill:#FF6B35,color:#fff
    style RES fill:#1565C0,color:#fff
    style VIL fill:#1565C0,color:#fff
```

### Key Points

- **Residents do NOT vote directly** for KSA board members
- Each **village HOA appoints a representative** to the KSA board (delegate model)
- Individual homeowners vote in **village HOA elections**, which indirectly influence KSA
- KSA has **0 employees** — all operations outsourced to KAM
- All board officers serve **unpaid** ($0 compensation)

### Current Board (2024–2025)

| Role | Name | Compensation |
|------|------|-------------|
| President | Delores Price | $0 |
| Vice President | William C. Manthei | $0 |
| Secretary | Maryanne Fortson | $0 |
| Treasurer | Scott Gilreath / John Kaskie | $0 |
| Managing Agent | Ethel McCormick | $0 from KSA (paid via KAM contract) |

---

## Political Structure — Overlapping Jurisdictions

```mermaid
graph TB
    subgraph "Federal"
        FED[Federal Government<br/>EPA, FEMA, Army Corps]
    end

    subgraph "State"
        TX[State of Texas<br/>Legislature, TCEQ, GLO]
    end

    subgraph "County"
        HC[Harris County<br/>Flood Control, Sheriff,<br/>Property Tax, Roads]
    end

    subgraph "City"
        HOU[City of Houston<br/>Police, Fire, Water/Sewer,<br/>Trash, Roads, Permits]
        DE[City Council District E<br/>Kingwood Representative]
        SN[Super Neighborhood #43<br/>Kingwood Advisory Council]
        TIRZ[Lake Houston TIRZ #42<br/>Tax Increment Zone<br/>Est. 1997]
    end

    subgraph "Private Community"
        KSA[KSA<br/>Parks, Entryways,<br/>Public Safety Liaison]
        VH[Village HOAs<br/>30+ neighborhoods<br/>Deed restrictions]
        TA[Trails Associations<br/>75+ miles of trails]
    end

    FED --> TX
    TX --> HC
    TX --> HOU
    HOU --> DE
    HOU --> SN
    HOU --> TIRZ
    HC -.->|"Flood control"| KSA
    HOU -.->|"Police/Fire liaison"| KSA
    VH -->|"Assessments + reps"| KSA
    VH -.->|"Trail fees"| TA

    style KSA fill:#1B5E20,color:#fff
    style HOU fill:#B71C1C,color:#fff
    style HC fill:#E65100,color:#fff
```

### Who Does What in Kingwood

| Service | Provider | Notes |
|---------|----------|-------|
| Police | Houston PD | KSA coordinates via Public Safety Committee |
| Fire/EMS | Houston FD | Replaced volunteer FD after 1996 annexation |
| Water/Sewer | City of Houston | Replaced 13 MUDs after annexation; bills doubled |
| Trash/Recycling | City of Houston | Weekly service |
| Roads | City of Houston + Harris County | Shared jurisdiction |
| Flood Control | Harris County Flood Control District | Major issue post-Harvey |
| Parks (5 private) | **KSA** | 356.6 acres, K-Sticker access |
| Public Parks | City of Houston Parks Dept | Separate from KSA parks |
| Entryway Landscaping | **KSA** | Kingwood Dr. medians, entrances |
| Deed Restrictions | Village HOAs | Architectural control, landscaping |
| Trails (75+ miles) | Trails Associations | Separate from KSA |
| Property Tax | Harris County Tax Office | Funds city, county, school, MUD debt |
| Schools | Humble ISD | Independent school district |

---

## KSA Revenue Flow

```mermaid
flowchart LR
    subgraph "Revenue Sources"
        A1[Village HOA<br/>Assessments<br/>$958K - 91.4%]
        A2[Investment<br/>Income<br/>$90K - 8.6%]
    end

    subgraph "KSA<br/>$1.05M Revenue"
        KSA_REV[KSA Budget<br/>$3.1M Assets]
    end

    subgraph "Spending Categories"
        S1[Parks Operations<br/>& Maintenance<br/>~44%]
        S2[General &<br/>Administrative<br/>~23%]
        S3[Entryway<br/>Maintenance<br/>~17%]
        S4[Park<br/>Improvements<br/>~15%]
        S5[Public Safety<br/>~2%]
    end

    A1 --> KSA_REV
    A2 --> KSA_REV
    KSA_REV --> S1
    KSA_REV --> S2
    KSA_REV --> S3
    KSA_REV --> S4
    KSA_REV --> S5

    style KSA_REV fill:#1B5E20,color:#fff
    style A1 fill:#1565C0,color:#fff
    style S1 fill:#FF6B35,color:#fff
```

---

## Assessment Flow — From Resident to Park

```mermaid
flowchart TD
    R[Homeowner] -->|"Pays HOA dues<br/>(varies by village)"| V[Village HOA]
    V -->|"Pays KSA assessment<br/>$295/lot/year"| KSA[KSA]
    KSA -->|"Contracts"| KAM[KAM<br/>Management Company]
    KAM -->|"Hires vendors"| MAINT[Landscaping<br/>Maintenance<br/>Security]
    MAINT -->|"Maintains"| PARKS[5 Parks<br/>356.6 Acres]
    KSA -->|"Funds"| ENT[Entryway<br/>Landscaping]
    KSA -->|"Coordinates"| PS[Public Safety<br/>HPD/HFD Liaison]
    R -->|"Gets K-Sticker"| PARKS

    style KSA fill:#1B5E20,color:#fff
    style R fill:#1565C0,color:#fff
    style PARKS fill:#FF6B35,color:#fff
```

---

## KSA Parks Map (Relative Positions)

```mermaid
graph TB
    subgraph "Kingwood — The Livable Forest"
        NP[Northpark<br/>Recreation Area] --- DR[Deer Ridge Park<br/>Tennis, Basketball,<br/>Pickleball, Duck Pond]
        DR --- CW[Creekwood Nature Area<br/>50-acre Woodland Preserve]
        CW --- EE[East End Park<br/>158.5 acres<br/>Boardwalks, Trails]
        CW --- RG[River Grove Park<br/>74 acres<br/>Disc Golf, Boat Ramp,<br/>Soccer, Fishing]
    end

    style RG fill:#1B5E20,color:#fff,stroke:#FF6B35,stroke-width:3px
    style EE fill:#2E7D32,color:#fff
    style DR fill:#388E3C,color:#fff
    style NP fill:#43A047,color:#fff
    style CW fill:#4CAF50,color:#fff
```

---

## Decision-Making Process

```mermaid
sequenceDiagram
    participant R as Residents
    participant V as Village HOA
    participant B as KSA Board
    participant C as Committee
    participant M as KAM (Management)
    participant VN as Vendors

    R->>V: Vote in village elections
    V->>B: Appoint representative
    V->>B: Pay annual assessment ($295/lot)
    B->>C: Assign issues to committees
    C->>B: Recommend actions
    B->>M: Approve budget & contracts
    M->>VN: Hire landscaping, maintenance
    VN->>R: Maintain parks, entryways
    R->>M: Request K-Sticker
    M->>R: Issue K-Sticker (park access)
```

---

## Sources

- [ProPublica Nonprofit Explorer - KSA](https://projects.propublica.org/nonprofits/organizations/741891991)
- [KSA Official Website](http://kingwoodserviceassociation.org/)
- [Kingwood.com - Community Guide](https://www.kingwood.com/community/)
- [HCAD Property Search](https://hcad.org/property-search/property-search)
- [Hunters Ridge Village - KSA Info](https://huntersridgevillage.com/ksa)
