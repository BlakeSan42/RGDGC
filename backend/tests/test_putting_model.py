"""Tests for the putting probability model."""

from app.services.putting_service import (
    calculate_make_probability,
    classify_zone,
    get_tour_average,
    PlayerPuttingParams,
    SKILL_PARAMS,
)


def test_point_blank_is_near_certain():
    """A putt from 1 meter should be very likely for pros, likely for recreational."""
    pro = calculate_make_probability(1.0, SKILL_PARAMS["pro"])
    assert pro > 0.90
    rec = calculate_make_probability(1.0, SKILL_PARAMS["recreational"])
    assert rec > 0.60


def test_long_putt_is_unlikely():
    """A putt from 20 meters should be hard."""
    prob = calculate_make_probability(20.0, SKILL_PARAMS["recreational"])
    assert prob < 0.30


def test_elite_better_than_beginner():
    """Elite players should make more putts at any distance."""
    distance = 10.0
    elite = calculate_make_probability(distance, SKILL_PARAMS["elite"])
    beginner = calculate_make_probability(distance, SKILL_PARAMS["beginner"])
    assert elite > beginner


def test_wind_reduces_probability():
    """Wind should decrease make probability."""
    params = SKILL_PARAMS["intermediate"]
    no_wind = calculate_make_probability(8.0, params, wind_speed=0)
    with_wind = calculate_make_probability(8.0, params, wind_speed=15, wind_direction=90)
    assert with_wind < no_wind


def test_elevation_reduces_probability():
    """Elevation change should decrease make probability."""
    params = SKILL_PARAMS["intermediate"]
    flat = calculate_make_probability(8.0, params)
    uphill = calculate_make_probability(8.0, params, elevation_change=1.5)
    assert uphill < flat


def test_classify_zone():
    assert classify_zone(5.0) == "c1"
    assert classify_zone(10.0) == "c1"
    assert classify_zone(15.0) == "c2"
    assert classify_zone(25.0) == "outside"


def test_tour_average_interpolation():
    avg = get_tour_average(7.0)
    assert 0.5 < avg < 1.0  # Should be around 0.78

    # Edge cases
    near = get_tour_average(1.0)
    assert near > 0.90

    far = get_tour_average(30.0)
    assert far < 0.30


def test_probability_bounds():
    """Probability should always be between 0 and 1."""
    for level in SKILL_PARAMS.values():
        for d in [0.5, 1, 3, 5, 10, 15, 20, 30]:
            prob = calculate_make_probability(float(d), level)
            assert 0.0 <= prob <= 1.0


def test_probability_decreases_with_distance():
    """Probability should generally decrease with distance."""
    params = SKILL_PARAMS["intermediate"]
    prev = 1.0
    for d in [3, 5, 7, 10, 15, 20]:
        prob = calculate_make_probability(float(d), params)
        assert prob <= prev
        prev = prob
