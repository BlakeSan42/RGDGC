"""Tests for the points calculation system."""

from app.services.points_service import calculate_points


def test_first_place_gets_max_points():
    assert calculate_points(8, 1) == 8
    assert calculate_points(12, 1) == 12


def test_last_place_gets_one_point():
    assert calculate_points(8, 8) == 1
    assert calculate_points(12, 12) == 1


def test_beyond_field_gets_zero():
    assert calculate_points(8, 9) == 0
    assert calculate_points(8, 100) == 0


def test_middle_positions():
    assert calculate_points(8, 2) == 7
    assert calculate_points(8, 4) == 5


def test_single_player():
    assert calculate_points(1, 1) == 1
