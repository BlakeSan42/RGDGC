"""GeoJSON API endpoints for course mapping and spatial queries."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import Geography
from geoalchemy2.functions import ST_AsGeoJSON, ST_Distance, ST_MakePoint, ST_SetSRID
from geoalchemy2.shape import to_shape
from sqlalchemy import select, cast, Float, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.course import Course, Layout, Hole, CourseFeature

router = APIRouter(tags=["geo"])


def _point_to_coords(geom) -> list[float] | None:
    """Convert a GeoAlchemy2 geometry to [lng, lat]."""
    if geom is None:
        return None
    shape = to_shape(geom)
    return [shape.x, shape.y]


def _line_to_coords(geom) -> list[list[float]] | None:
    """Convert a GeoAlchemy2 LineString to [[lng, lat], ...]."""
    if geom is None:
        return None
    shape = to_shape(geom)
    return [[c[0], c[1]] for c in shape.coords]


def _geom_to_geojson(geom) -> dict | None:
    """Convert any GeoAlchemy2 geometry to GeoJSON dict."""
    if geom is None:
        return None
    shape = to_shape(geom)
    return json.loads(json.dumps(shape.__geo_interface__))


@router.get("/courses/{course_id}/geojson")
async def get_course_geojson(
    course_id: int,
    layout_id: Optional[int] = Query(None, description="Filter holes by layout"),
    include_features: bool = Query(True, description="Include OB, mandos, trees, etc."),
    db: AsyncSession = Depends(get_db),
):
    """
    Get full GeoJSON FeatureCollection for a course.

    Includes: holes (tee, basket, fairway), OB zones, mandos, trees, paths, water.
    Ready to render directly in Mapbox GL.
    """
    # Get course
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    features = []

    # Course boundary
    if course.boundary:
        features.append({
            "type": "Feature",
            "id": f"course-boundary-{course.id}",
            "geometry": _geom_to_geojson(course.boundary),
            "properties": {
                "type": "course_boundary",
                "name": course.name,
            },
        })

    # Get holes
    hole_query = select(Hole).join(Layout)
    if layout_id:
        hole_query = hole_query.where(Layout.id == layout_id, Layout.course_id == course_id)
    else:
        hole_query = hole_query.where(Layout.course_id == course_id, Layout.is_default.is_(True))

    result = await db.execute(hole_query.options(selectinload(Hole.layout)))
    holes = result.scalars().all()

    for hole in holes:
        # Tee pad point
        if hole.tee_position:
            features.append({
                "type": "Feature",
                "id": f"tee-{hole.id}",
                "geometry": _geom_to_geojson(hole.tee_position),
                "properties": {
                    "type": "tee",
                    "hole_number": hole.hole_number,
                    "par": hole.par,
                    "distance_ft": hole.distance,
                    "elevation_ft": hole.tee_elevation_ft,
                    "layout": hole.layout.name if hole.layout else None,
                },
            })

        # Basket point
        if hole.basket_position:
            features.append({
                "type": "Feature",
                "id": f"basket-{hole.id}",
                "geometry": _geom_to_geojson(hole.basket_position),
                "properties": {
                    "type": "basket",
                    "hole_number": hole.hole_number,
                    "par": hole.par,
                    "elevation_ft": hole.basket_elevation_ft,
                    "elevation_change_ft": hole.elevation_change_ft,
                },
            })

        # Fairway line
        if hole.fairway_line:
            features.append({
                "type": "Feature",
                "id": f"fairway-{hole.id}",
                "geometry": _geom_to_geojson(hole.fairway_line),
                "properties": {
                    "type": "fairway",
                    "hole_number": hole.hole_number,
                    "par": hole.par,
                    "distance_ft": hole.distance,
                    "elevation_change_ft": hole.elevation_change_ft,
                },
            })

    # Course features (OB, mandos, trees, etc.)
    if include_features:
        result = await db.execute(
            select(CourseFeature).where(CourseFeature.course_id == course_id)
        )
        course_features = result.scalars().all()

        for feat in course_features:
            props = {
                "type": feat.feature_type,
                "name": feat.name,
                "description": feat.description,
                "affects_holes": feat.affects_holes,
            }
            # Merge JSON properties
            if feat.properties:
                try:
                    props.update(json.loads(feat.properties))
                except (json.JSONDecodeError, TypeError):
                    pass

            features.append({
                "type": "Feature",
                "id": f"feature-{feat.id}",
                "geometry": _geom_to_geojson(feat.geom),
                "properties": props,
            })

    return {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "course_id": course.id,
            "course_name": course.name,
            "center": [float(course.longitude), float(course.latitude)] if course.latitude else None,
            "layout_id": layout_id,
            "total_features": len(features),
        },
    }


@router.get("/courses/{course_id}/holes/{hole_number}/elevation")
async def get_hole_elevation_profile(
    course_id: int,
    hole_number: int,
    layout_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get elevation profile data for a specific hole."""
    hole_query = (
        select(Hole)
        .join(Layout)
        .where(Layout.course_id == course_id, Hole.hole_number == hole_number)
    )
    if layout_id:
        hole_query = hole_query.where(Layout.id == layout_id)
    else:
        hole_query = hole_query.where(Layout.is_default.is_(True))

    result = await db.execute(hole_query)
    hole = result.scalar_one_or_none()
    if not hole:
        raise HTTPException(status_code=404, detail="Hole not found")

    profile = None
    if hole.elevation_profile:
        try:
            profile = json.loads(hole.elevation_profile)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "hole_number": hole.hole_number,
        "par": hole.par,
        "distance_ft": hole.distance,
        "tee_elevation_ft": hole.tee_elevation_ft,
        "basket_elevation_ft": hole.basket_elevation_ft,
        "elevation_change_ft": hole.elevation_change_ft,
        "profile": profile,
    }


@router.get("/nearest-hole")
async def find_nearest_hole(
    lat: float = Query(..., description="Current latitude"),
    lng: float = Query(..., description="Current longitude"),
    course_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Find the nearest tee pad to a GPS position.

    Used for auto-detecting which hole a player is on.
    Returns the closest hole with distance in meters.
    """
    user_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

    query = (
        select(
            Hole.hole_number,
            Hole.par,
            Hole.distance.label("hole_distance_ft"),
            ST_Distance(
                cast(Hole.tee_position, Geography),
                cast(user_point, Geography),
            ).label("distance_m"),
        )
        .join(Layout)
        .where(Hole.tee_position.isnot(None))
    )

    if course_id:
        query = query.where(Layout.course_id == course_id)

    # Only search default layout to avoid duplicates
    query = query.where(Layout.is_default.is_(True))
    query = query.order_by("distance_m").limit(1)

    result = await db.execute(query)
    row = result.first()

    if not row:
        return {"found": False, "message": "No holes with GPS data found"}

    return {
        "found": True,
        "hole_number": row.hole_number,
        "distance_m": round(row.distance_m, 1),
        "distance_ft": round(row.distance_m * 3.28084, 1),
        "par": row.par,
        "hole_distance_ft": row.hole_distance_ft,
    }
