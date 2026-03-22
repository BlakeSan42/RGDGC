"""
Unit test conftest — override the root conftest's autouse DB fixtures.
Unit tests must not require a database connection.
"""

import pytest


@pytest.fixture(autouse=True)
def setup_tables():
    """No-op: unit tests don't need database tables."""
    yield None, None


@pytest.fixture(autouse=True)
def ensure_test_db():
    """No-op: unit tests don't need database creation."""
    pass
