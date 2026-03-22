# RGDGC Putting Physics Model

## Overview

The RGDGC app includes a sophisticated putting analysis system based on probabilistic physics models adapted from golf putting research. This document details the mathematical foundation, implementation approach, and user-facing features.

---

## 1. Theoretical Foundation

### 1.1 Source Research

Our model draws from:
- **Gelman & Nolan (2002)**: "A Probability Model for Golf Putting" — established the angular/distance error framework
- **Broadie (2014)**: "Every Shot Counts" — professional golf strokes-gained analysis
- **Aalto University Case Study**: Disc golf putting adaptation
- **PDGA/UDisc Statistics**: Real-world disc golf putting percentages by distance

### 1.2 Key Insight: Putting as Probabilistic Process

Putting success is modeled as the intersection of three independent factors:
1. **Angular accuracy** — did the disc travel toward the basket?
2. **Distance accuracy** — did the disc reach the basket with correct speed?
3. **Random error** — mishits, wind gusts, mental errors (yips)

---

## 2. Physical Parameters

### 2.1 Disc Golf vs Ball Golf Geometry

| Parameter | Ball Golf | Disc Golf | Impact |
|-----------|-----------|-----------|--------|
| **Target diameter** | 4.25 in (10.8 cm) | 21.25 in (53.98 cm) | ~5× larger target |
| **Projectile diameter** | 1.68 in (4.27 cm) | ~8.5 in (21.6 cm) | ~5× larger projectile |
| **Effective clearance** | 2.57 in | 12.75 in | Net advantage to disc golf |
| **Chains vs hole** | Binary (in/out) | Chains catch discs | More forgiving |
| **Ground vs air** | Rolling on ground | Flight through air | More variables |

### 2.2 Basket Geometry

```
     ┌─────────────────┐
     │    Top Band     │  ← 21.25" diameter
     │   ┌─────────┐   │
     │   │ Chains  │   │  ← Inner chains ~15" diameter
     │   │  ↓↓↓↓   │   │
     │   └─────────┘   │
     │      Tray       │  ← Catches disc
     └────────┬────────┘
              │
           Pole
```

**Critical dimensions:**
- Outer band diameter: 21.25 inches (PDGA standard)
- Chain assembly: 12-18 chains in inner/outer rings
- Tray depth: ~3 inches
- Pole height to tray: ~24 inches from ground

---

## 3. Mathematical Model

### 3.1 Angular Accuracy Model

For a putt from distance `x` meters, the angular threshold `θ₀` defines the maximum angular error that still results in the disc hitting the basket:

```
θ₀ = arcsin((R - r) / x)

Where:
  R = basket radius = 10.625 inches = 0.27 m
  r = disc radius = 4.25 inches = 0.108 m
  x = distance to basket (meters)
```

**Angular accuracy probability:**

We model angular error as normally distributed with standard deviation `σ_angle`:

```
P_angle = 2 × Φ(θ₀ / σ_angle) - 1

Where:
  Φ = standard normal CDF
  σ_angle = player's angular accuracy (radians)
```

**Example calculations:**

| Distance | θ₀ (degrees) | θ₀ (radians) |
|----------|--------------|--------------|
| 3m (10ft) | 3.09° | 0.054 |
| 6m (20ft) | 1.54° | 0.027 |
| 10m (33ft) | 0.93° | 0.016 |
| 15m (50ft) | 0.62° | 0.011 |
| 20m (66ft) | 0.46° | 0.008 |

### 3.2 Distance Accuracy Model

The disc must reach the basket (not fall short) but not fly past the chains. We model this as:

```
P_distance = Φ((d_max - x) / σ_distance) - Φ((d_min - x) / σ_distance)

Where:
  d_max = maximum distance where chains can still catch = x + 0.5m (typical)
  d_min = minimum distance to reach basket = x
  σ_distance = player's distance control (meters)
```

**Simplified model (for implementation):**

```
P_distance = Φ(overshot / σ_distance)

Where:
  overshot = target overshot distance (typically 0.3-0.5m past basket)
```

### 3.3 Random Error Factor

Account for mishits, wind, and mental errors:

```
ε = random error probability (typically 0.02 - 0.10)
```

### 3.4 Combined Success Probability

```
P_success = P_angle × P_distance × (1 - ε)
```

**Full formula:**

```javascript
function puttingProbability(distance_m, sigma_angle, sigma_distance, epsilon = 0.03) {
  const R = 0.27;  // basket radius (m)
  const r = 0.108; // disc radius (m)
  
  // Angular threshold
  const theta_0 = Math.asin((R - r) / distance_m);
  
  // Angular probability (normal CDF)
  const P_angle = 2 * normalCDF(theta_0 / sigma_angle) - 1;
  
  // Distance probability (assuming 0.4m overshot target)
  const overshot = 0.4;
  const P_distance = normalCDF(overshot / sigma_distance);
  
  // Combined probability
  return P_angle * P_distance * (1 - epsilon);
}

function normalCDF(x) {
  // Approximation using error function
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}
```

---

## 4. Player Skill Parameters

### 4.1 Skill Parameter Definitions

| Parameter | Symbol | Units | Description |
|-----------|--------|-------|-------------|
| Angular accuracy | σ_angle | radians | Standard deviation of aiming error |
| Distance control | σ_distance | meters | Standard deviation of distance error |
| Random error | ε | probability | Probability of mishit |
| Mental factor | ψ | multiplier | Pressure adjustment (tournament vs casual) |

### 4.2 Skill Level Profiles

Based on analysis of PDGA statistics and UDisc data:

| Skill Level | σ_angle (rad) | σ_distance (m) | ε | C1X % | C2 % |
|-------------|---------------|----------------|---|-------|------|
| **Beginner** | 0.08 | 1.2 | 0.10 | ~50% | ~10% |
| **Recreational** | 0.05 | 0.8 | 0.06 | ~65% | ~18% |
| **Intermediate** | 0.035 | 0.5 | 0.04 | ~75% | ~25% |
| **Advanced** | 0.025 | 0.35 | 0.03 | ~82% | ~32% |
| **Pro (MPO)** | 0.018 | 0.25 | 0.02 | ~88% | ~38% |
| **Elite (Lead Card)** | 0.015 | 0.20 | 0.015 | ~92% | ~42% |

### 4.3 Parameter Fitting Algorithm

Given a player's putting history, we fit their skill parameters using Maximum Likelihood Estimation:

```python
import numpy as np
from scipy.optimize import minimize
from scipy.stats import norm

def fit_player_parameters(putt_data):
    """
    putt_data: list of (distance_m, made: bool) tuples
    Returns: (sigma_angle, sigma_distance, epsilon)
    """
    
    def negative_log_likelihood(params):
        sigma_angle, sigma_distance, epsilon = params
        
        # Ensure valid parameter ranges
        if sigma_angle <= 0 or sigma_distance <= 0 or epsilon < 0 or epsilon > 1:
            return np.inf
        
        log_likelihood = 0
        for distance, made in putt_data:
            prob = putting_probability(distance, sigma_angle, sigma_distance, epsilon)
            prob = np.clip(prob, 1e-10, 1 - 1e-10)  # Avoid log(0)
            
            if made:
                log_likelihood += np.log(prob)
            else:
                log_likelihood += np.log(1 - prob)
        
        return -log_likelihood
    
    # Initial guess based on intermediate player
    x0 = [0.035, 0.5, 0.04]
    
    # Bounds
    bounds = [(0.01, 0.15), (0.1, 2.0), (0.005, 0.2)]
    
    result = minimize(negative_log_likelihood, x0, bounds=bounds, method='L-BFGS-B')
    
    return result.x
```

---

## 5. Disc Golf Putting Zones

### 5.1 Standard Zone Definitions

| Zone | Distance | Description |
|------|----------|-------------|
| **Tap-in** | 0-3.3m (0-11ft) | Gimme putts |
| **C1** | 0-10m (0-33ft) | Circle 1 — inside the circle |
| **C1X** | 3.3-10m (11-33ft) | Circle 1 excluding tap-ins |
| **C2** | 10-20m (33-66ft) | Circle 2 — outside the circle |
| **Long Range** | 20m+ (66ft+) | Beyond Circle 2 |

### 5.2 Professional Benchmarks (2024-2025 DGPT Data)

**MPO (Men's Professional Open):**
| Zone | Tour Average | Top 10 Players | Elite (Lead Card) |
|------|--------------|----------------|-------------------|
| C1X | 78% | 84% | 88%+ |
| C2 | 28% | 34% | 38%+ |
| 10m (33ft) | 82% | 88% | 92% |
| 15m (50ft) | 45% | 52% | 58% |
| 20m (66ft) | 25% | 32% | 38% |

**FPO (Women's Professional Open):**
| Zone | Tour Average | Top 10 Players |
|------|--------------|----------------|
| C1X | 72% | 78% |
| C2 | 22% | 28% |

### 5.3 Amateur Benchmarks

| Skill Level | C1 (30ft) | C2 (50ft) | Notes |
|-------------|-----------|-----------|-------|
| Beginner | 40-55% | 5-10% | First year playing |
| Recreational | 55-70% | 10-18% | Casual weekly player |
| Intermediate | 70-80% | 18-28% | Competitive amateur |
| Advanced | 80-88% | 28-35% | Tournament player |

---

## 6. Environmental Factors

### 6.1 Wind Adjustment

Wind significantly affects putting, especially at longer distances:

```javascript
function windAdjustedProbability(baseProb, distance_m, windSpeed_mph, windAngle_deg) {
  // Wind effect increases with distance
  const windFactor = 1 - (windSpeed_mph * distance_m * 0.002);
  
  // Crosswind is worse than headwind/tailwind
  const crosswindMultiplier = Math.abs(Math.sin(windAngle_deg * Math.PI / 180));
  const effectiveWindFactor = 1 - ((1 - windFactor) * (0.5 + 0.5 * crosswindMultiplier));
  
  return baseProb * Math.max(0.1, effectiveWindFactor);
}
```

**Wind impact table:**

| Wind Speed | C1 Impact | C2 Impact |
|------------|-----------|-----------|
| Calm (0-5 mph) | -0% to -2% | -0% to -5% |
| Light (5-10 mph) | -2% to -5% | -5% to -15% |
| Moderate (10-15 mph) | -5% to -10% | -15% to -30% |
| Strong (15-20 mph) | -10% to -20% | -30% to -50% |
| Gusty (20+ mph) | -20% to -35% | -50% to -70% |

### 6.2 Elevation Adjustment

Uphill/downhill putts affect distance control:

```javascript
function elevationAdjustedSigma(sigma_distance, elevationChange_m, distance_m) {
  const elevationRatio = elevationChange_m / distance_m;
  const adjustmentFactor = 1 + Math.abs(elevationRatio) * 0.5;
  return sigma_distance * adjustmentFactor;
}
```

### 6.3 Obstacle Factors

Low ceiling, mandos, and obstacles increase σ_angle:

```javascript
function obstacleAdjustedSigma(sigma_angle, obstacleType) {
  const adjustments = {
    'clear': 1.0,
    'low_ceiling': 1.3,
    'gap': 1.5,
    'mando': 1.2,
    'straddle': 1.4
  };
  return sigma_angle * (adjustments[obstacleType] || 1.0);
}
```

---

## 7. App Integration

### 7.1 Data Collection

**Per-putt data captured:**

```typescript
interface PuttAttempt {
  id: string;
  roundId: string;
  holeNumber: number;
  
  // Distance & position
  distanceMeters: number;
  distanceFeet: number;
  zone: 'tapIn' | 'c1x' | 'c2' | 'longRange';
  
  // Environmental
  elevationChange?: number;
  windSpeed?: number;
  windDirection?: number;
  
  // Outcome
  made: boolean;
  chainHit?: boolean;
  resultType?: 'center_chains' | 'outer_chains' | 'band' | 'miss_left' | 'miss_right' | 'short' | 'long';
  
  // Metadata
  timestamp: Date;
  puttStyle?: 'spin' | 'push' | 'spush' | 'turbo' | 'straddle';
  discUsed?: string;
  pressure?: 'casual' | 'tournament' | 'playoff';
}
```

### 7.2 Real-time Make Probability Display

Before each putt, show the player their expected make percentage:

```typescript
function getPersonalMakeProbability(
  player: PlayerProfile,
  distance: number,
  conditions: PuttConditions
): PuttPrediction {
  
  // Get player's fitted parameters
  const { sigmaAngle, sigmaDistance, epsilon } = player.puttingParams;
  
  // Calculate base probability
  let prob = puttingProbability(distance, sigmaAngle, sigmaDistance, epsilon);
  
  // Apply environmental adjustments
  if (conditions.windSpeed) {
    prob = windAdjustedProbability(prob, distance, conditions.windSpeed, conditions.windDirection);
  }
  
  if (conditions.elevationChange) {
    const adjSigma = elevationAdjustedSigma(sigmaDistance, conditions.elevationChange, distance);
    prob = puttingProbability(distance, sigmaAngle, adjSigma, epsilon);
  }
  
  // Apply pressure factor
  const pressureMultipliers = {
    casual: 1.0,
    tournament: 0.95,
    playoff: 0.90
  };
  prob *= pressureMultipliers[conditions.pressure] || 1.0;
  
  return {
    probability: prob,
    percentDisplay: `${Math.round(prob * 100)}%`,
    confidence: calculateConfidenceInterval(prob, player.totalPutts),
    comparisonToAverage: prob - getAverageForDistance(distance),
    practiceRecommendation: prob < 0.7 ? 'Focus practice here' : null
  };
}
```

### 7.3 User Interface Elements

**Pre-putt display:**

```
┌──────────────────────────────────────┐
│  📍 25 feet (7.6m) — C1X             │
│                                      │
│     Your Make Rate: 71%              │
│     ████████████████░░░░░            │
│                                      │
│     Tour Average:   78%              │
│     Your History:   68% (17/25)      │
│                                      │
│  🌬️ Wind: 8 mph crosswind (-5%)     │
└──────────────────────────────────────┘
```

**Post-round analysis:**

```
┌──────────────────────────────────────┐
│  PUTTING ANALYSIS — Round #47       │
│                                      │
│  Overall: 8/11 (73%)                 │
│                                      │
│  C1X:  6/7  (86%)  ↑ 4% vs avg      │
│  C2:   2/4  (50%)  ↑ 8% vs avg      │
│                                      │
│  Strokes Gained Putting: +0.8       │
│                                      │
│  📈 Improvement Area:               │
│  15-20ft range: 2/4 (50%)           │
│  → Recommended drill: Circle 1 Edge │
└──────────────────────────────────────┘
```

---

## 8. Strokes Gained Putting

### 8.1 Concept

Strokes Gained measures performance vs. baseline expectations. For putting:

```
SG_Putting = Σ (Expected_strokes_baseline - Actual_strokes)
```

### 8.2 Expected Strokes by Distance

Based on tour averages, expected strokes to hole out from each distance:

| Distance | Expected Strokes | Make % Implied |
|----------|------------------|----------------|
| 3m (10ft) | 1.05 | 95% |
| 5m (16ft) | 1.12 | 88% |
| 7m (23ft) | 1.22 | 78% |
| 10m (33ft) | 1.35 | 65% |
| 12m (40ft) | 1.55 | 45% |
| 15m (50ft) | 1.72 | 28% |
| 20m (66ft) | 1.88 | 12% |

### 8.3 Calculation Example

```javascript
function calculateStrokesGainedPutting(putts: PuttAttempt[]): number {
  const expectedStrokes = {
    3: 1.05, 5: 1.12, 7: 1.22, 10: 1.35,
    12: 1.55, 15: 1.72, 20: 1.88
  };
  
  function getExpectedStrokes(distance_m: number): number {
    // Interpolate between known distances
    const distances = Object.keys(expectedStrokes).map(Number).sort((a, b) => a - b);
    
    if (distance_m <= distances[0]) return expectedStrokes[distances[0]];
    if (distance_m >= distances[distances.length - 1]) {
      return expectedStrokes[distances[distances.length - 1]];
    }
    
    for (let i = 0; i < distances.length - 1; i++) {
      if (distance_m >= distances[i] && distance_m < distances[i + 1]) {
        const ratio = (distance_m - distances[i]) / (distances[i + 1] - distances[i]);
        return expectedStrokes[distances[i]] + 
          ratio * (expectedStrokes[distances[i + 1]] - expectedStrokes[distances[i]]);
      }
    }
    
    return 1.5; // Default fallback
  }
  
  let totalSG = 0;
  
  for (const putt of putts) {
    const expected = getExpectedStrokes(putt.distanceMeters);
    const actual = putt.made ? 1 : 2; // Simplified: made = 1, miss = 2
    totalSG += expected - actual;
  }
  
  return totalSG;
}
```

---

## 9. Practice Recommendations

### 9.1 Weakness Detection

```typescript
function identifyWeaknesses(player: PlayerProfile): PracticeRecommendation[] {
  const recommendations: PracticeRecommendation[] = [];
  
  // Analyze by distance bucket
  const buckets = [
    { name: 'Tap-in (0-10ft)', min: 0, max: 3, expected: 0.98 },
    { name: 'Short C1 (10-20ft)', min: 3, max: 6, expected: 0.85 },
    { name: 'Mid C1 (20-30ft)', min: 6, max: 9, expected: 0.72 },
    { name: 'C1 Edge (30-33ft)', min: 9, max: 10, expected: 0.65 },
    { name: 'Short C2 (33-45ft)', min: 10, max: 14, expected: 0.40 },
    { name: 'Long C2 (45-66ft)', min: 14, max: 20, expected: 0.22 }
  ];
  
  for (const bucket of buckets) {
    const puttsInBucket = player.puttHistory.filter(
      p => p.distanceMeters >= bucket.min && p.distanceMeters < bucket.max
    );
    
    if (puttsInBucket.length >= 5) {
      const makeRate = puttsInBucket.filter(p => p.made).length / puttsInBucket.length;
      
      if (makeRate < bucket.expected * 0.85) {
        recommendations.push({
          zone: bucket.name,
          currentRate: makeRate,
          expectedRate: bucket.expected,
          deficit: bucket.expected - makeRate,
          drill: getDrillForZone(bucket.name),
          priority: bucket.expected - makeRate > 0.15 ? 'high' : 'medium'
        });
      }
    }
  }
  
  return recommendations.sort((a, b) => b.deficit - a.deficit);
}
```

### 9.2 Practice Drills

**C1 Drills:**

| Drill Name | Description | Goal |
|------------|-------------|------|
| **Circle of Death** | 5 discs at each clock position (12 total), must make all 60 | 100% C1 |
| **21** | Score points by distance: 10ft=1, 20ft=2, 30ft=3. First to 21. | Consistency |
| **Pressure Cooker** | Must make 10 in a row from 20ft before moving out | Mental toughness |
| **Horse** | Match shots with partner | Fun competition |

**C2 Drills:**

| Drill Name | Description | Goal |
|------------|-------------|------|
| **Ladder** | Start at 33ft, move back 3ft after each make | Extend range |
| **50/50** | 20 putts from 50ft, track percentage | C2 baseline |
| **Confidence Builder** | Make 5 from 40ft before leaving | C2 muscle memory |

---

## 10. API Endpoints

### 10.1 Putting Statistics

```
GET /api/v1/players/{id}/putting-stats

Response:
{
  "playerId": "uuid",
  "totalPutts": 523,
  "overallMakeRate": 0.724,
  "zoneStats": {
    "c1x": { "attempts": 312, "made": 258, "rate": 0.827 },
    "c2": { "attempts": 156, "made": 42, "rate": 0.269 }
  },
  "distanceCurve": [
    { "distanceFeet": 10, "attempts": 45, "rate": 0.956 },
    { "distanceFeet": 15, "attempts": 62, "rate": 0.871 },
    // ...
  ],
  "fittedParams": {
    "sigmaAngle": 0.032,
    "sigmaDistance": 0.42,
    "epsilon": 0.035
  },
  "strokesGainedPutting": 0.34,
  "trend": {
    "last30Days": 0.748,
    "previous30Days": 0.712,
    "change": 0.036
  }
}
```

### 10.2 Make Probability Prediction

```
POST /api/v1/putting/predict

Request:
{
  "playerId": "uuid",
  "distanceMeters": 7.5,
  "conditions": {
    "windSpeed": 8,
    "windDirection": 90,
    "elevation": -0.3
  }
}

Response:
{
  "probability": 0.71,
  "display": "71%",
  "confidence": [0.65, 0.77],
  "comparison": {
    "vsPersonalAverage": 0.03,
    "vsTourAverage": -0.07
  },
  "factors": {
    "baseProb": 0.75,
    "windAdjustment": -0.04,
    "elevationAdjustment": 0.00
  }
}
```

---

## 11. Future Enhancements

### 11.1 Machine Learning Integration

- Train neural network on large putting dataset
- Account for putting style (spin vs push)
- Incorporate disc-specific factors
- Player fatigue modeling

### 11.2 Video Analysis

- Use computer vision to detect release angle
- Measure nose angle at release
- Track spin rate estimation
- Identify mechanical inconsistencies

### 11.3 Biometric Integration

- Heart rate impact on putting
- Hand steadiness correlation
- Optimal pre-putt routine duration

---

## 12. References

1. Gelman, A., & Nolan, D. (2002). "A Probability Model for Golf Putting." *Teaching Statistics*, 24(3), 93-95.

2. Broadie, M. (2014). *Every Shot Counts: Using the Revolutionary Strokes Gained Approach to Improve Your Golf Performance and Strategy*. Gotham Books.

3. Aalto University. "Disc Golf Putting Case Study." https://users.aalto.fi/~ave/casestudies/disc_putting/

4. UDisc. (2024). "Professional Disc Golf Statistics." https://udisc.com/stats

5. PDGA. (2024). "Player Ratings and Statistics." https://www.pdga.com/players/stats

---

*Document Version: 1.0*
*Last Updated: March 2026*
*Author: RGDGC Development Team*
