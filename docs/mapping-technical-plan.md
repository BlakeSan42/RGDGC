# RGDGC Mapping Feature: State-of-the-Art Technical Plan
## "Beat UDisc" Disc Golf Course Mapping

*Research Date: March 2026*
*Target: React Native (Expo 52) + FastAPI backend*

---

## Table of Contents
1. [Satellite & Aerial Imagery](#1-satellite--aerial-imagery)
2. [3D Terrain & Elevation Data](#2-3d-terrain--elevation-data)
3. [React Native Mapping Libraries](#3-react-native-mapping-libraries)
4. [Weather & Wind Data](#4-weather--wind-data)
5. [What UDisc Does (and Where They Fall Short)](#5-what-udisc-does-and-where-they-fall-short)
6. [Feature Architecture](#6-feature-architecture)
7. [Innovative Features Beyond UDisc](#7-innovative-features-beyond-udisc)
8. [API Endpoints to Build](#8-api-endpoints-to-build)
9. [Data Storage & Schema](#9-data-storage--schema)
10. [NPM Packages & Python Libraries](#10-npm-packages--python-libraries)
11. [Cost Estimates](#11-cost-estimates)
12. [Implementation Priority & Roadmap](#12-implementation-priority--roadmap)
13. [Architecture Recommendations](#13-architecture-recommendations)

---

## 1. Satellite & Aerial Imagery

### Provider Comparison

| Provider | Resolution | Coverage | Update Freq | Cost | API Access | Best For |
|----------|-----------|----------|-------------|------|------------|----------|
| **Mapbox Satellite** | 0.5-1m (urban), 15m (rural) | Global | Irregular | 50K free loads/mo, then $5/1K | Tile API | **RECOMMENDED** - best RN integration |
| **Google Maps** | 0.15-0.3m (urban) | Global | Monthly-quarterly | $7/1K loads (first $200/mo free) | Maps SDK | Highest resolution but expensive |
| **Esri/ArcGIS** | 0.3-1m | Global | Varies | $100/mo+ | REST API | Enterprise, overkill for this |
| **Planet (SkySat)** | 0.5m | Global | Daily revisit | Enterprise ($$$) | REST API | Monitoring changes, expensive |
| **Maxar** | 0.3m | Global | Custom tasking | Enterprise ($$$) | ARD API | Military/gov grade, way overkill |
| **Nearmap** | 0.05-0.07m (5-7cm!) | US/AU/CA/NZ cities | 2-3x/year | Enterprise ($$$) | Tile API | Absolute best resolution |
| **NAIP (USDA)** | 0.6m | US only | Every 2-3 years | FREE | AWS Open Data | Free alternative, good enough |

### Recommendation: Mapbox Satellite + NAIP Fallback

**Why Mapbox wins:**
- Native React Native SDK (`@rnmapbox/maps` v10.3) with 3D terrain
- Satellite imagery at 0.5-1m is sufficient to see tee pads and baskets
- 50,000 free map loads/month (enough for early growth)
- Offline map support built in
- Custom style layers for drawing OB lines, mandos, etc.
- Composites from Maxar, DigitalGlobe, and open sources

**NAIP as free backup:**
- 0.6m resolution, covers all of US including River Grove
- Available on AWS Open Data Registry: `s3://naip-visualization/`
- Can serve as custom raster tiles in Mapbox

### Sub-Meter Resolution Confirmation
Yes, sub-meter resolution is achievable:
- Mapbox: 0.5m in urban areas (River Grove qualifies as Chicago metro)
- NAIP: 0.6m nationwide (free)
- Google: 0.15m (but more expensive SDK)

---

## 2. 3D Terrain & Elevation Data

### Available Datasets

| Source | Resolution | Coverage | Cost | API | Format |
|--------|-----------|----------|------|-----|--------|
| **USGS 3DEP (1m DEM)** | **1 meter** | US (expanding) | FREE | REST + S3 | GeoTIFF/COG |
| **USGS EPQS** | ~10m (queries 1m data) | US | FREE | REST | JSON |
| **Mapbox Terrain DEM v1** | ~5m (zoom 14), 0.1m vertical | Global | Included with maps | Tile API | Terrain-RGB PNG |
| **Copernicus GLO-30** | 30m | Global | FREE | AWS S3 | GeoTIFF |
| **Copernicus GLO-90** | 90m | Global | FREE | AWS S3 | GeoTIFF |
| **SRTM** | 30m (US), 90m (global) | 60N-56S | FREE | USGS EarthExplorer | HGT |
| **Google Elevation API** | ~10-30m | Global | $5/1K requests | REST | JSON |

### River Grove DGC, Kingwood TX Elevation Data

**Course coordinates:** (30.027066, -95.208576)
**Location:** River Grove Park, 800 Woodland Hills Dr, Kingwood, TX 77339

Elevation data needs to be fetched from USGS EPQS for the correct Kingwood, TX coordinates.
The course sits along the San Jacinto River floodplain — relatively flat terrain with
some minor topography. Harris County has full 1m LiDAR DEM coverage via USGS 3DEP.

**USGS EPQS API call:**
```
https://epqs.nationalmap.gov/v1/json?x=-95.208576&y=30.027066&wkid=4326&units=Feet
```

River Grove is relatively flat (Des Plaines River floodplain), but the 1m DEM can capture even subtle 0.1m elevation changes useful for drainage/putt breaks.

### USGS Elevation API (FREE, no auth needed)
```
GET https://epqs.nationalmap.gov/v1/json?x={lng}&y={lat}&wkid=4326&units=Meters
```
- No API key required
- No rate limit published (reasonable use expected)
- Returns elevation from best available DEM (1m 3DEP where available)

### 3D Terrain in React Native

**Mapbox is the only viable option for native 3D terrain:**
- `@rnmapbox/maps` supports `<Terrain>` component (Mapbox Maps SDK v11)
- Uses `mapbox://mapbox.mapbox-terrain-dem-v1` tileset
- 0.1m vertical precision
- Supports exaggeration factor for visual effect
- Also supports `<Atmosphere>` and `<SkyLayer>` for immersive 3D

**Code pattern:**
```jsx
import Mapbox from '@rnmapbox/maps';

<Mapbox.MapView styleURL={Mapbox.StyleURL.SatelliteStreet}>
  <Mapbox.RasterDemSource
    id="mapbox-dem"
    url="mapbox://mapbox.mapbox-terrain-dem-v1"
    tileSize={514}
  >
    <Mapbox.Terrain style={{ exaggeration: 1.5 }} />
  </Mapbox.RasterDemSource>
  <Mapbox.SkyLayer id="sky" />
  <Mapbox.Camera
    pitch={60}
    heading={0}
    centerCoordinate={[-95.208576, 30.027066]}
    zoomLevel={17}
  />
</Mapbox.MapView>
```

---

## 3. React Native Mapping Libraries

### Head-to-Head Comparison

| Feature | @rnmapbox/maps (v10.3) | react-native-maps (v1.26) | MapLibre RN (v10.4) |
|---------|----------------------|-------------------------|---------------------|
| **Provider** | Mapbox GL (SDK v11) | Google Maps / Apple Maps | MapLibre (open source) |
| **Satellite tiles** | Yes (Mapbox) | Yes (Google/Apple) | Yes (any tile source) |
| **3D terrain** | **YES (native)** | No | Partial (community) |
| **Custom overlays** | Yes (layers API) | Yes (Polygon/Polyline) | Yes (layers API) |
| **Offline maps** | **Yes (OfflineManager)** | Limited (LocalTile only) | Yes |
| **Heatmap layer** | **Yes (HeatmapLayer)** | Yes (basic) | Yes |
| **Animations** | Camera fly-to, pitch | Region animation | Camera fly-to |
| **Expo support** | Dev client only | Dev client only | **Yes (Expo plugin)** |
| **Cost** | Mapbox pricing | Google pricing | **FREE** |
| **Line/Polygon drawing** | ShapeSource + layers | Polyline/Polygon | ShapeSource + layers |
| **User location** | Yes + LocationPuck | Yes | Yes |
| **Heading/compass** | Yes | Limited | Yes |
| **Callouts/popups** | Yes | Yes | Yes |
| **Performance** | Excellent (GPU) | Good | Good (GPU) |
| **Flyover animation** | **Yes (camera animation)** | No | Partial |

### VERDICT: @rnmapbox/maps

**@rnmapbox/maps is the clear winner** because it is the ONLY library that provides:
1. Native 3D terrain rendering (critical for elevation profiles and flyover)
2. Full offline map support (OfflineManager for downloaded regions)
3. HeatmapLayer for throw distribution visualization
4. Camera pitch/bearing animation for flyover mode
5. Satellite + street hybrid style
6. Line/fill layers with opacity for OB zones and mandos

**MapLibre as backup:** If budget is a concern later, MapLibre uses similar API patterns and is fully free. Migration path is straightforward.

**react-native-maps is NOT suitable:** No 3D terrain, no heatmap layers, limited offline. It's fine for basic pin-dropping but inadequate for a UDisc-killer.

### deck.gl Note
deck.gl does NOT support React Native. It is WebGL-only (browser). Not viable for native mobile 3D visualization. Mapbox's built-in layers (heatmap, fill-extrusion, line) cover everything deck.gl would provide.

---

## 4. Weather & Wind Data

### Provider Comparison

| Provider | Wind Data | Free Tier | Paid Cost | Update Freq | Best For |
|----------|----------|-----------|-----------|-------------|----------|
| **OpenWeatherMap** | Speed + direction (10m height) | 1M calls/mo, 60/min | $0+ (One Call 3.0: 1K/day free) | Real-time | **RECOMMENDED** |
| **Tomorrow.io** | Speed + direction + gusts | 5-day forecast, 1 location | Enterprise | Minutely (paid) | Premium wind |
| **Visual Crossing** | Speed + direction (10-100m) | 1K records/day | $0.0001/record | Historical + forecast | Historical analysis |
| **Open-Meteo** | Speed + direction + gusts | **Unlimited (non-commercial)** | $0+ commercial | Hourly/daily | **FREE option** |
| **WeatherAPI.com** | Speed + direction + gusts | 1M calls/mo | From $9/mo | Real-time + 14-day | Good free tier |

### Recommendation: OpenWeatherMap + Open-Meteo

**Primary: OpenWeatherMap One Call 3.0**
- Wind speed, direction, gusts at 10m height
- 1,000 free API calls/day
- Minutely precipitation for next hour
- Hourly forecast for 48 hours
- Daily forecast for 8 days

**Fallback/Supplement: Open-Meteo**
- Completely free for non-commercial use
- Wind at multiple heights (10m, 80m, 120m)
- Historical data back decades
- No API key needed

**Wind overlay implementation:**
```python
# Backend endpoint
GET /api/v1/weather/wind?lat=30.027066&lng=-95.208576

# Response
{
  "wind_speed_mph": 12.3,
  "wind_direction_deg": 225,  # SW
  "wind_gust_mph": 18.1,
  "temperature_f": 68,
  "feels_like_f": 65,
  "conditions": "partly_cloudy",
  "updated_at": "2026-03-22T14:30:00Z"
}
```

---

## 5. What UDisc Does (and Where They Fall Short)

### UDisc Current Features
- **Hole maps:** Photo-based, user-uploaded images with drawn overlays (NOT satellite)
- **GPS distance:** Real-time distance to basket
- **Throw measurement:** Mark where disc lands, see distance
- **Course conditions:** Crowdsourced text updates
- **Scorekeeping:** Core feature, very polished
- **Course directory:** Largest database (15K+ courses)
- **Statistics:** Round history, putting stats
- **Technology:** Uses Mapbox for course directory map

### UDisc Weaknesses (Our Opportunities)

| UDisc Gap | Our Advantage |
|-----------|--------------|
| Photo-based hole maps (not satellite) | **True satellite imagery with overlaid OB/mando** |
| No elevation data shown | **3D terrain + elevation profile per hole** |
| No wind information | **Real-time wind overlay on map** |
| Basic throw measurement | **Throw tracking with elevation change calculation** |
| No flyover mode | **3D animated flyover of each hole** |
| No heat maps | **Crowdsourced throw/landing heatmaps** |
| No AR features | **AR distance + navigation** |
| No LiDAR scanning | **iPhone Pro LiDAR for 3D course models** |
| No offline satellite maps | **Download course maps for offline play** |
| Limited course creation tools | **Admin tool to draw OB/mandos on satellite imagery** |
| No real-time tournament tracking | **Live player positions on map during events** |
| Course conditions are text-only | **Photo-verified conditions with timestamps** |

---

## 6. Feature Architecture

### Feature 1: Satellite Hole Maps with Overlays

**How it works:**
- Admin draws OB lines, mando arrows, tee pads, basket positions on satellite imagery
- Stored as GeoJSON in PostgreSQL (PostGIS)
- Rendered as Mapbox ShapeSource layers on satellite basemap
- Players see each hole with all features drawn on real imagery

**Implementation:**
```jsx
// Hole map view
<Mapbox.MapView styleURL={Mapbox.StyleURL.Satellite}>
  <Mapbox.ShapeSource id="ob-zones" shape={obGeoJSON}>
    <Mapbox.FillLayer id="ob-fill" style={{
      fillColor: 'rgba(255, 0, 0, 0.25)',
      fillOutlineColor: '#FF0000'
    }} />
  </Mapbox.ShapeSource>
  <Mapbox.ShapeSource id="mando-lines" shape={mandoGeoJSON}>
    <Mapbox.LineLayer id="mando-line" style={{
      lineColor: '#FFFF00',
      lineWidth: 3,
      lineDasharray: [2, 2]
    }} />
  </Mapbox.ShapeSource>
  <Mapbox.PointAnnotation id="tee" coordinate={teeCoord}>
    <TeePadIcon />
  </Mapbox.PointAnnotation>
  <Mapbox.PointAnnotation id="basket" coordinate={basketCoord}>
    <BasketIcon />
  </Mapbox.PointAnnotation>
</Mapbox.MapView>
```

### Feature 2: GPS Distance to Basket (Real-Time)

**How it works:**
- `expo-location` watches position at `Accuracy.BestForNavigation`
- Haversine formula calculates distance to basket coordinate
- Updates every 1-3 seconds while playing
- Shows distance in feet (US) or meters

**Implementation:**
```typescript
import * as Location from 'expo-location';
import { getDistance } from 'geolib';

const watchPosition = async (basketCoord: [number, number]) => {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 1, // update every 1 meter moved
      timeInterval: 2000,  // or every 2 seconds
    },
    (location) => {
      const distanceMeters = getDistance(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        { latitude: basketCoord[1], longitude: basketCoord[0] }
      );
      const distanceFeet = Math.round(distanceMeters * 3.28084);
      setDistanceToBasket(distanceFeet);
    }
  );
};
```

### Feature 3: Throw Measurement

**How it works:**
- Player taps "Mark Throw" at current position
- Walks to where disc landed, taps "Mark Landing"
- App calculates distance, shows on map with line
- BONUS: Queries elevation at both points, shows altitude change
- BONUS: Accounts for elevation in "true distance" vs "map distance"

### Feature 4: Elevation Profile Per Hole

**How it works:**
- Backend queries USGS EPQS for elevation at N points along hole centerline
- Returns elevation profile data (distance vs elevation)
- Frontend renders with a chart library (victory-native or react-native-chart-kit)
- Shows total elevation gain/loss, max grade

**Backend implementation:**
```python
import httpx
import numpy as np

async def get_elevation_profile(
    start: tuple[float, float],
    end: tuple[float, float],
    num_points: int = 20
) -> list[dict]:
    """Sample elevation along a line from tee to basket."""
    lats = np.linspace(start[0], end[0], num_points)
    lngs = np.linspace(start[1], end[1], num_points)

    elevations = []
    async with httpx.AsyncClient() as client:
        for lat, lng in zip(lats, lngs):
            resp = await client.get(
                "https://epqs.nationalmap.gov/v1/json",
                params={"x": lng, "y": lat, "wkid": 4326, "units": "Meters"}
            )
            data = resp.json()
            elevations.append({
                "lat": lat,
                "lng": lng,
                "elevation_m": float(data["value"]),
                "distance_from_tee_m": haversine(start, (lat, lng))
            })

    return elevations
```

### Feature 5: Wind Overlay

**How it works:**
- Fetch wind data from OpenWeatherMap on round start and every 10 minutes
- Display wind arrow on map (direction) with speed label
- Color-coded: green (<5mph), yellow (5-15), orange (15-25), red (25+)
- Arrow rotates based on wind direction relative to hole direction
- Shows headwind/tailwind/crosswind indicator per hole

### Feature 6: Throw Heatmaps

**How it works:**
- All throw/landing positions stored in PostGIS
- Backend aggregates into heatmap grid per hole
- Rendered using Mapbox HeatmapLayer
- Shows common landing zones, popular throw lines, trouble spots

```jsx
<Mapbox.ShapeSource id="throws" shape={throwPointsGeoJSON}>
  <Mapbox.HeatmapLayer
    id="throw-heat"
    style={{
      heatmapWeight: ['interpolate', ['linear'], ['get', 'count'], 0, 0, 10, 1],
      heatmapIntensity: ['interpolate', ['linear'], ['zoom'], 15, 1, 20, 3],
      heatmapColor: [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,255,0)',
        0.2, 'rgb(0,0,255)',
        0.4, 'rgb(0,255,0)',
        0.6, 'rgb(255,255,0)',
        0.8, 'rgb(255,128,0)',
        1, 'rgb(255,0,0)'
      ],
      heatmapRadius: 20,
      heatmapOpacity: 0.6
    }}
  />
</Mapbox.ShapeSource>
```

### Feature 7: 3D Flyover Mode

**How it works:**
- Pre-compute camera path along hole centerline
- Animate camera with pitch (60 degrees), bearing following hole direction
- Satellite + 3D terrain enabled
- Smooth animation using Mapbox camera transitions
- Player can trigger flyover before throwing on each hole

```jsx
const flyoverHole = async (tee: [number, number], basket: [number, number]) => {
  const bearing = calculateBearing(tee, basket);

  // Start at tee, looking toward basket
  cameraRef.current?.setCamera({
    centerCoordinate: tee,
    zoomLevel: 18,
    pitch: 65,
    heading: bearing,
    animationDuration: 0,
  });

  // Fly to basket over 5 seconds
  setTimeout(() => {
    cameraRef.current?.flyTo({
      centerCoordinate: basket,
      zoomLevel: 17,
      pitch: 45,
      heading: bearing,
      animationDuration: 5000,
    });
  }, 1000);
};
```

---

## 7. Innovative Features Beyond UDisc

### 7a. iPhone LiDAR 3D Course Scanning

**Technology:** iPhone 12 Pro+ have LiDAR scanner (4m range, good for nearby terrain)
**Libraries:**
- `expo-three` + `three.js` for 3D rendering
- ARKit (native module) for LiDAR point cloud capture
- `react-native-scenekit` or custom native module

**Use case:** Scan tee pad area, basket surroundings, key obstacles. Create 3D mesh of course features. Share as community content.

**Reality check:** LiDAR range is only 5m, so it captures local detail not full holes. Best for: tee pad quality, basket condition, obstacle mapping.

### 7b. AR Navigation

**Technology:** ARKit (iOS) + ARCore (Android)
**Implementation:**
- Point phone toward basket, see AR overlay with:
  - Distance to basket (GPS + compass)
  - Direction arrow
  - Elevation change indicator
  - Wind direction relative to throw line
- Use `expo-location` heading + GPS for positioning

**Libraries:**
- `expo-sensors` (compass/heading)
- `react-native-arkit` / `viro-community/viro` for AR overlay
- Or simpler: compass-based overlay without full AR (lower barrier)

### 7c. Drone Mapping Integration

**Feasibility:** High complexity, niche audience
**Approach:** Accept drone orthomosaic uploads (GeoTIFF) as custom tile overlays
**Tools:** OpenDroneMap (open source) for processing
**Best as:** Admin/course designer feature, not player-facing

### 7d. ML Throw Prediction

**Concept:** Given wind speed/direction, elevation change, distance, and disc selection, predict optimal throw line and landing zone.

**Implementation:**
```python
# Backend ML service
# Trained on aggregated throw data from all players
# Features: distance, elevation_delta, wind_speed, wind_direction,
#           disc_speed, disc_glide, disc_turn, disc_fade

from sklearn.ensemble import GradientBoostingRegressor
# or use a simple physics model first, ML later when data exists

def predict_landing(
    throw_point: tuple,
    disc: DiscProfile,
    wind: WindData,
    throw_angle: float,
    power: float
) -> tuple[float, float]:
    """Predict landing coordinates."""
    # Phase 1: Physics-based model (Bernoulli + drag)
    # Phase 2: ML model trained on real throw data
    pass
```

**Phase 1 (no ML):** Use disc flight number physics model (already in game engine!)
**Phase 2 (with data):** Train on real throw tracking data from users

### 7e. Crowdsourced Course Conditions

**Features:**
- Photo upload with GPS tag + timestamp
- Condition categories: Dry, Wet, Muddy, Flooded, Snow, Leaves
- Upvote/downvote accuracy
- Auto-expire after 24-48 hours
- Aggregated "course condition score" (1-5)

### 7f. Real-Time Tournament Tracking

**Features:**
- Players share location during tournament rounds
- Live map shows all player positions
- Live leaderboard overlay on map
- Spectators can follow specific players
- Uses WebSocket for real-time updates

**Backend:**
```python
# WebSocket endpoint for live tracking
@app.websocket("/ws/tournament/{event_id}/track")
async def tournament_tracking(websocket: WebSocket, event_id: int):
    await manager.connect(websocket, event_id)
    while True:
        data = await websocket.receive_json()
        # Broadcast player position to all spectators
        await manager.broadcast(event_id, {
            "player_id": data["player_id"],
            "lat": data["lat"],
            "lng": data["lng"],
            "hole": data["current_hole"],
            "score": data["current_score"]
        })
```

---

## 8. API Endpoints to Build

### Course Mapping Endpoints

```
# Course geometry
GET    /api/v1/courses/{id}/map              # Full course map data (GeoJSON)
GET    /api/v1/courses/{id}/holes/{num}/map   # Single hole map data
POST   /api/v1/courses/{id}/holes/{num}/map   # Admin: save hole geometry
PUT    /api/v1/courses/{id}/holes/{num}/map   # Admin: update hole geometry

# Elevation
GET    /api/v1/elevation/point?lat=X&lng=Y    # Single point elevation
GET    /api/v1/elevation/profile?start=X,Y&end=X,Y&points=20  # Profile

# Weather/Wind
GET    /api/v1/weather/current?lat=X&lng=Y    # Current conditions + wind
GET    /api/v1/weather/forecast?lat=X&lng=Y   # 48-hour hourly forecast

# Throw tracking
POST   /api/v1/throws                         # Record throw (start + end coords)
GET    /api/v1/throws/heatmap/{hole_id}       # Aggregated throw heatmap data

# Course conditions
POST   /api/v1/courses/{id}/conditions        # Report condition + photo
GET    /api/v1/courses/{id}/conditions         # Current conditions
POST   /api/v1/courses/{id}/conditions/{id}/vote  # Upvote/downvote

# Offline data
GET    /api/v1/courses/{id}/offline-bundle    # All data needed for offline play

# Tournament tracking
WS     /ws/tournament/{event_id}/track        # Real-time position broadcast
GET    /api/v1/tournaments/{id}/live-map      # Current positions snapshot
```

---

## 9. Data Storage & Schema

### New Database Tables

```sql
-- Hole geometry (GeoJSON stored in PostGIS)
CREATE TABLE hole_maps (
    id SERIAL PRIMARY KEY,
    hole_id INTEGER REFERENCES holes(id),
    layout_id INTEGER REFERENCES layouts(id),
    tee_position GEOMETRY(POINT, 4326),
    basket_position GEOMETRY(POINT, 4326),
    fairway_centerline GEOMETRY(LINESTRING, 4326),
    ob_zones GEOMETRY(MULTIPOLYGON, 4326),    -- out of bounds areas
    mando_lines JSONB,                         -- [{geometry, direction, type}]
    drop_zones GEOMETRY(MULTIPOINT, 4326),
    elevation_profile JSONB,                   -- [{distance_m, elevation_m}]
    hole_distance_ft INTEGER,                  -- official distance
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Throw tracking (for heatmaps + analytics)
CREATE TABLE throw_tracks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    round_id INTEGER REFERENCES rounds(id),
    hole_id INTEGER REFERENCES holes(id),
    throw_number INTEGER,                      -- 1 = drive, 2 = approach, etc.
    start_position GEOMETRY(POINT, 4326),
    end_position GEOMETRY(POINT, 4326),
    start_elevation_m FLOAT,
    end_elevation_m FLOAT,
    distance_ft INTEGER,
    disc_name VARCHAR(100),
    throw_type VARCHAR(20),                    -- backhand, forehand, roller, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create spatial index for heatmap queries
CREATE INDEX idx_throw_tracks_end_pos ON throw_tracks USING GIST(end_position);
CREATE INDEX idx_throw_tracks_hole ON throw_tracks(hole_id);

-- Course conditions
CREATE TABLE course_conditions (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    user_id INTEGER REFERENCES users(id),
    condition_type VARCHAR(20),                -- dry, wet, muddy, flooded, snow, leaves
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    photo_url VARCHAR(500),
    photo_position GEOMETRY(POINT, 4326),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    expires_at TIMESTAMP,                      -- auto-expire after 48h
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cached weather data
CREATE TABLE weather_cache (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    wind_speed_mph FLOAT,
    wind_direction_deg INTEGER,
    wind_gust_mph FLOAT,
    temperature_f FLOAT,
    feels_like_f FLOAT,
    conditions VARCHAR(50),
    humidity INTEGER,
    fetched_at TIMESTAMP DEFAULT NOW()
);

-- Offline map regions
CREATE TABLE offline_regions (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    bounds_sw GEOMETRY(POINT, 4326),
    bounds_ne GEOMETRY(POINT, 4326),
    zoom_min INTEGER DEFAULT 14,
    zoom_max INTEGER DEFAULT 19,
    tile_count INTEGER,
    size_bytes BIGINT,
    last_updated TIMESTAMP DEFAULT NOW()
);
```

### PostGIS Requirement
Add PostGIS extension to PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Railway PostgreSQL supports PostGIS. Add to requirements:
```
GeoAlchemy2==0.15.0
shapely==2.0.6
```

### Storage Estimates

| Data Type | Per Course | 1000 Courses | Notes |
|-----------|-----------|-------------|-------|
| Hole geometry (GeoJSON) | ~50 KB | 50 MB | PostGIS |
| Elevation profiles | ~10 KB | 10 MB | JSONB in PostgreSQL |
| Throw tracks (1 year) | ~5 MB | 5 GB | PostGIS points |
| Condition photos | ~2 MB/photo | 200 GB | S3/R2 (expire after 48h) |
| Offline map tiles | ~50 MB/course | N/A | On-device only |
| Weather cache | ~1 KB | Negligible | Redis preferred |

---

## 10. NPM Packages & Python Libraries

### Mobile (React Native / Expo)

```json
{
  "dependencies": {
    // MAPPING (core)
    "@rnmapbox/maps": "^10.3.0",          // Mapbox GL Native maps + 3D terrain
    "expo-location": "~18.0.0",            // GPS, heading, background location
    "geolib": "^3.3.4",                    // Distance calculations (haversine)
    "@turf/turf": "^7.0.0",               // GeoJSON operations, bearing, midpoint

    // CHARTS (elevation profile)
    "victory-native": "^41.0.0",           // Charts for elevation profile
    "react-native-svg": "^15.0.0",         // SVG rendering (victory dep)

    // AR (Phase 2)
    "expo-sensors": "~14.0.0",             // Compass/heading for AR overlay
    // "react-native-arkit": TBD           // Full AR (native module)

    // OFFLINE
    "@react-native-async-storage/async-storage": "^2.0.0",  // Local data cache
    "react-native-mmkv": "^3.0.0",         // Fast key-value storage

    // REAL-TIME
    "socket.io-client": "^4.7.0",          // WebSocket for tournament tracking

    // CAMERA (conditions photos)
    "expo-camera": "~16.0.0",
    "expo-image-picker": "~16.0.0"
  }
}
```

### Backend (FastAPI / Python)

```
# Add to requirements.txt

# Geo/Mapping
GeoAlchemy2==0.15.0              # PostGIS integration with SQLAlchemy
shapely==2.0.6                   # Geometry operations
geopy==2.4.1                     # Distance calculations
pyproj==3.7.0                    # Coordinate transformations
geojson==3.1.0                   # GeoJSON parsing/validation

# Weather
httpx==0.28.1                    # Already have - async HTTP client

# Elevation
rasterio==1.4.0                  # Read GeoTIFF DEMs (optional, for local DEM)
numpy==2.0.0                     # Numerical (elevation profiles)

# Image processing (condition photos)
Pillow==11.0.0                   # Image resizing/compression
boto3==1.35.0                    # S3/R2 upload

# WebSocket (tournament tracking)
websockets==13.0                 # FastAPI WebSocket support (built in)

# Caching
redis==5.2.1                     # Already have - cache weather/elevation
```

---

## 11. Cost Estimates

### Monthly Costs by Scale

| Service | 100 users | 1,000 users | 10,000 users |
|---------|----------|------------|-------------|
| **Mapbox** (50K free loads) | $0 | $0 | ~$250 |
| **OpenWeatherMap** (1M free) | $0 | $0 | $0 |
| **USGS Elevation** | $0 | $0 | $0 |
| **Open-Meteo** (free) | $0 | $0 | $0 |
| **S3/R2** (condition photos) | $0 | $5 | $25 |
| **Railway PostgreSQL** | $15 | $25 | $50 |
| **PostGIS overhead** | $0 | $0 | $0 |
| **TOTAL** | **$15/mo** | **$30/mo** | **$325/mo** |

### One-Time / Setup Costs
- Mapbox account: Free
- USGS: Free, no account needed
- PostGIS: Free extension
- Course mapping labor: Manual (admin draws OB/mandos per course)

### Key Cost Notes
- Mapbox: 50,000 free map loads/month, then $5 per additional 1,000
- A "map load" = one user session with the map visible
- 100 daily active users * 30 days = 3,000 map loads/month (well under free tier)
- USGS + Open-Meteo are completely free with no API keys
- The biggest cost scaling factor is Mapbox at 10K+ users
- At that scale, consider MapLibre (free) with self-hosted tiles as migration path

---

## 12. Implementation Priority & Roadmap

### Phase 1: Foundation (Weeks 1-3) -- SHIP THIS FIRST
1. **Mapbox integration** -- Install @rnmapbox/maps, get satellite view working
2. **Course map schema** -- PostGIS tables, hole geometry storage
3. **Tee + basket coordinates** -- Enter coords for River Grove holes
4. **GPS distance to basket** -- Real-time distance display during round
5. **Basic hole map view** -- Satellite image with tee/basket markers

### Phase 2: Core Differentiation (Weeks 4-6)
6. **OB zones + mandos** -- Admin draws on map, render as overlays
7. **Throw measurement** -- Mark throw + landing, calculate distance
8. **Elevation profile** -- USGS API integration, chart per hole
9. **Wind overlay** -- OpenWeatherMap integration, arrow on map
10. **Offline course download** -- Mapbox OfflineManager for course tiles

### Phase 3: Advanced Features (Weeks 7-10)
11. **3D terrain** -- Enable Mapbox 3D terrain, camera pitch
12. **Flyover mode** -- Animated camera path along each hole
13. **Throw heatmaps** -- Aggregate throw data, render HeatmapLayer
14. **Course conditions** -- Photo upload, condition reporting
15. **Elevation-adjusted distance** -- True distance accounting for elevation

### Phase 4: Innovation (Weeks 11-16)
16. **AR distance overlay** -- Compass-based distance/direction display
17. **Tournament live tracking** -- WebSocket real-time positions
18. **ML throw prediction** -- Physics model, then data-trained model
19. **LiDAR scanning** -- iPhone Pro 3D capture (native module)
20. **Drone map upload** -- Accept orthomosaic tiles from course designers

### Minimum Viable "UDisc Killer" (Phase 1 + 2)
With just Phase 1 and 2 complete, you will have:
- Satellite imagery (UDisc uses photos, not satellite)
- Real-time GPS distance (matches UDisc)
- OB/mando overlays on real imagery (better than UDisc)
- Throw measurement (matches UDisc)
- Elevation profiles (UDisc doesn't have this)
- Wind data on map (UDisc doesn't have this)
- Offline maps (UDisc doesn't do this well)

That is already a significant competitive advantage in 6 weeks.

---

## 13. Architecture Recommendations

### Mobile Architecture

```
mobile/src/
├── features/
│   └── mapping/
│       ├── components/
│       │   ├── CourseMap.tsx           # Main map view (Mapbox)
│       │   ├── HoleMapView.tsx        # Single hole satellite view
│       │   ├── ObZoneOverlay.tsx      # OB zone polygons
│       │   ├── MandoOverlay.tsx       # Mando line arrows
│       │   ├── ThrowLine.tsx          # Throw start->end line
│       │   ├── WindArrow.tsx          # Wind direction overlay
│       │   ├── ElevationChart.tsx     # Elevation profile chart
│       │   ├── HeatmapOverlay.tsx     # Throw distribution heatmap
│       │   ├── DistanceBadge.tsx      # GPS distance display
│       │   ├── FlyoverButton.tsx      # Trigger 3D flyover
│       │   └── OfflineDownload.tsx    # Download course for offline
│       ├── hooks/
│       │   ├── useGpsDistance.ts       # Real-time distance to basket
│       │   ├── useThrowTracking.ts    # Mark throw + landing positions
│       │   ├── useWindData.ts         # Fetch + cache wind data
│       │   ├── useElevation.ts        # Fetch elevation profile
│       │   ├── useOfflineMaps.ts      # Manage offline map downloads
│       │   └── useFlyover.ts          # Camera animation logic
│       ├── utils/
│       │   ├── geo.ts                 # Haversine, bearing, midpoint
│       │   ├── geojson.ts             # GeoJSON helpers
│       │   └── mapStyles.ts           # Mapbox style constants
│       └── types/
│           └── mapping.ts             # TypeScript types for map data
```

### Backend Architecture

```
backend/app/
├── api/v1/
│   ├── mapping.py                     # Course map CRUD endpoints
│   ├── elevation.py                   # Elevation proxy/cache
│   ├── weather.py                     # Weather proxy/cache
│   ├── throws.py                      # Throw tracking + heatmap
│   └── conditions.py                  # Course condition reports
├── services/
│   ├── elevation_service.py           # USGS API client + caching
│   ├── weather_service.py             # OpenWeatherMap client + caching
│   ├── mapping_service.py             # GeoJSON operations, PostGIS queries
│   └── heatmap_service.py             # Throw aggregation for heatmaps
├── models/
│   ├── hole_map.py                    # SQLAlchemy + GeoAlchemy2 model
│   ├── throw_track.py                 # Throw tracking model
│   └── course_condition.py            # Condition report model
```

### Key Design Decisions

1. **Proxy weather/elevation through backend** -- Cache in Redis, avoid exposing API keys to mobile, rate limit upstream calls.

2. **PostGIS for all geometry** -- Spatial indexes make heatmap queries fast. GeoJSON in/out is native.

3. **Mapbox OfflineManager for offline** -- Downloads tile packs to device. User triggers download per course. Include GeoJSON overlay data in offline bundle.

4. **Redis cache for weather** -- 10-minute TTL. One upstream API call serves all users at same course.

5. **WebSocket for tournament tracking** -- FastAPI has built-in WebSocket support. Use Redis pub/sub for multi-instance scaling.

6. **Elevation profiles pre-computed** -- Compute on course creation/update, store in JSONB. Don't query USGS on every hole view.

7. **Throw heatmaps materialized** -- Run aggregation job hourly/daily, not on every request. Store pre-computed grid in Redis or JSONB.

### Performance Targets

| Operation | Target | Approach |
|-----------|--------|----------|
| Map load (satellite tiles) | <2s first load | Mapbox CDN + offline cache |
| GPS distance update | <100ms | On-device calculation |
| Hole map data fetch | <200ms | PostgreSQL + Redis cache |
| Elevation profile | <500ms | Pre-computed, cached |
| Wind data | <300ms | Redis cache (10-min TTL) |
| Throw heatmap | <1s | Pre-aggregated, cached |
| Flyover animation | 60fps | Mapbox GPU rendering |
| Offline hole view | Instant | All data on device |

---

## Summary: The Stack

```
┌──────────────────────────────────────────────────────────┐
│                    MAPPING STACK                          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  IMAGERY:   Mapbox Satellite (0.5m, free 50K loads/mo)   │
│  TERRAIN:   Mapbox Terrain DEM v1 (0.1m vertical)        │
│  ELEVATION: USGS 3DEP/EPQS (1m DEM, FREE, no key)       │
│  WIND:      OpenWeatherMap (1M calls/mo free)             │
│  WEATHER:   Open-Meteo (unlimited free backup)            │
│                                                           │
│  MOBILE:    @rnmapbox/maps v10.3                          │
│             + expo-location (GPS + compass)                │
│             + geolib + @turf/turf (geo math)              │
│             + victory-native (elevation charts)            │
│                                                           │
│  BACKEND:   FastAPI + PostGIS + GeoAlchemy2               │
│             + Redis (weather/elevation cache)              │
│             + httpx (upstream API calls)                   │
│             + WebSocket (tournament tracking)              │
│                                                           │
│  STORAGE:   PostgreSQL + PostGIS (geometry)               │
│             Redis (caching)                                │
│             S3/R2 (condition photos)                       │
│                                                           │
│  COST:      $15-30/mo at launch                           │
│             $0 for imagery/elevation/weather               │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**This stack gives you satellite imagery, 3D terrain, elevation profiles, real-time wind, throw heatmaps, offline maps, and 3D flyover -- none of which UDisc currently offers. All for effectively $0 in API costs at launch scale.**
