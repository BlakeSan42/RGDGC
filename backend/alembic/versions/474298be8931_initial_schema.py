"""initial schema

Revision ID: 474298be8931
Revises:
Create Date: 2026-03-22 13:33:52.887595
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# PostGIS is optional — geo columns degrade to Text when unavailable
HAS_POSTGIS = False
try:
    import geoalchemy2
    # Check if PostGIS is actually available in the database
    from alembic import context
    HAS_POSTGIS = True
except ImportError:
    pass


revision: str = '474298be8931'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _geo_col(geometry_type, srid=4326):
    """Return a Geometry column if PostGIS available, else nullable Text."""
    if HAS_POSTGIS:
        return geoalchemy2.types.Geometry(geometry_type=geometry_type, srid=srid)
    return sa.Text()


def upgrade() -> None:
    # Enable PostGIS if available
    global HAS_POSTGIS
    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    except Exception:
        HAS_POSTGIS = False

    # === Users ===
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('username', sa.String(50), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('display_name', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('role', sa.String(20), server_default='player'),
        sa.Column('auth_provider', sa.String(20), server_default='email', nullable=False),
        sa.Column('google_id', sa.String(255), unique=True, nullable=True),
        sa.Column('apple_id', sa.String(255), unique=True, nullable=True),
        sa.Column('wallet_address', sa.String(42), nullable=True),
        sa.Column('handicap', sa.Numeric(4, 1), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Courses ===
    op.create_table(
        'courses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(50), nullable=True),
        sa.Column('country', sa.String(50), server_default='USA'),
        sa.Column('latitude', sa.Numeric(10, 7), nullable=True),
        sa.Column('longitude', sa.Numeric(10, 7), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('photo_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('boundary', _geo_col('POLYGON'), nullable=True),
    )
    op.create_index('idx_courses_boundary', 'courses', ['boundary'], postgresql_using='gist')

    # === Layouts ===
    op.create_table(
        'layouts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('holes', sa.Integer(), server_default='18'),
        sa.Column('total_par', sa.Integer(), nullable=False),
        sa.Column('total_distance', sa.Integer(), nullable=True),
        sa.Column('difficulty', sa.String(20), nullable=True),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Holes ===
    op.create_table(
        'holes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('layout_id', sa.Integer(), sa.ForeignKey('layouts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hole_number', sa.Integer(), nullable=False),
        sa.Column('par', sa.Integer(), nullable=False),
        sa.Column('distance', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('photo_url', sa.String(500), nullable=True),
        # Geo columns
        sa.Column('tee_position', _geo_col('POINT'), nullable=True),
        sa.Column('basket_position', _geo_col('POINT'), nullable=True),
        sa.Column('fairway_line', geoalchemy2.types.Geometry(
            geometry_type='LINESTRING', srid=4326), nullable=True),
        # Elevation data
        sa.Column('tee_elevation_ft', sa.Float(), nullable=True),
        sa.Column('basket_elevation_ft', sa.Float(), nullable=True),
        sa.Column('elevation_change_ft', sa.Float(), nullable=True),
        sa.Column('elevation_profile', sa.Text(), nullable=True),
    )
    op.create_index('idx_holes_tee_position', 'holes', ['tee_position'], postgresql_using='gist')
    op.create_index('idx_holes_basket_position', 'holes', ['basket_position'], postgresql_using='gist')
    op.create_index('idx_holes_fairway_line', 'holes', ['fairway_line'], postgresql_using='gist')

    # === Course Features (GIS) ===
    op.create_table(
        'course_features',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('feature_type', sa.String(30), nullable=False),
        sa.Column('name', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('geom', geoalchemy2.types.Geometry(
            geometry_type='GEOMETRY', srid=4326), nullable=False),
        sa.Column('properties', sa.Text(), nullable=True),
        sa.Column('affects_holes', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Rounds ===
    op.create_table(
        'rounds',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('layout_id', sa.Integer(), sa.ForeignKey('layouts.id'), nullable=False),
        sa.Column('started_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('total_score', sa.Integer(), nullable=True),
        sa.Column('total_strokes', sa.Integer(), nullable=True),
        sa.Column('weather', sa.String(50), nullable=True),
        sa.Column('wind', sa.String(50), nullable=True),
        sa.Column('temperature', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_practice', sa.Boolean(), server_default=sa.text('false')),
    )

    # === Hole Scores ===
    op.create_table(
        'hole_scores',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('round_id', sa.Integer(), sa.ForeignKey('rounds.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hole_id', sa.Integer(), sa.ForeignKey('holes.id'), nullable=False),
        sa.Column('strokes', sa.Integer(), nullable=False),
        sa.Column('putts', sa.Integer(), nullable=True),
        sa.Column('fairway_hit', sa.Boolean(), nullable=True),
        sa.Column('green_in_regulation', sa.Boolean(), nullable=True),
        sa.Column('ob_strokes', sa.Integer(), server_default='0'),
        sa.Column('penalty_strokes', sa.Integer(), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Leagues ===
    op.create_table(
        'leagues',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('season', sa.String(20), nullable=True),
        sa.Column('league_type', sa.String(20), nullable=False),
        sa.Column('points_rule', sa.String(50), server_default='field_size'),
        sa.Column('drop_worst', sa.Integer(), server_default='0'),
        sa.Column('max_events', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Events ===
    op.create_table(
        'events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('league_id', sa.Integer(), sa.ForeignKey('leagues.id', ondelete='CASCADE'), nullable=False),
        sa.Column('layout_id', sa.Integer(), sa.ForeignKey('layouts.id'), nullable=True),
        sa.Column('name', sa.String(100), nullable=True),
        sa.Column('event_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), server_default='upcoming'),
        sa.Column('num_players', sa.Integer(), nullable=True),
        sa.Column('entry_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('entry_fee_rgdg', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Teams ===
    op.create_table(
        'teams',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Team Members ===
    op.create_table(
        'team_members',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.UniqueConstraint('team_id', 'user_id'),
    )

    # === Results ===
    op.create_table(
        'results',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id'), nullable=True),
        sa.Column('round_id', sa.Integer(), sa.ForeignKey('rounds.id'), nullable=True),
        sa.Column('total_strokes', sa.Integer(), nullable=False),
        sa.Column('total_score', sa.Integer(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=True),
        sa.Column('points_earned', sa.Integer(), nullable=True),
        sa.Column('handicap_used', sa.Numeric(4, 1), nullable=True),
        sa.Column('handicap_score', sa.Integer(), nullable=True),
        sa.Column('dnf', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('dq', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Prizes ===
    op.create_table(
        'prizes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('league_id', sa.Integer(), sa.ForeignKey('leagues.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('amount_usd', sa.Numeric(10, 2), nullable=True),
        sa.Column('amount_rgdg', sa.Integer(), nullable=True),
        sa.UniqueConstraint('league_id', 'position'),
    )

    # === Putt Attempts ===
    op.create_table(
        'putt_attempts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('round_id', sa.Integer(), sa.ForeignKey('rounds.id'), nullable=True),
        sa.Column('distance_meters', sa.Float(), nullable=False),
        sa.Column('zone', sa.String(10), nullable=False),
        sa.Column('made', sa.Boolean(), nullable=False),
        sa.Column('elevation_change', sa.Float(), nullable=True),
        sa.Column('wind_speed', sa.Float(), nullable=True),
        sa.Column('wind_direction', sa.Integer(), nullable=True),
        sa.Column('chain_hit', sa.Boolean(), nullable=True),
        sa.Column('result_type', sa.String(20), nullable=True),
        sa.Column('putt_style', sa.String(10), nullable=True),
        sa.Column('disc_used', sa.String(50), nullable=True),
        sa.Column('pressure', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Registered Discs ===
    op.create_table(
        'registered_discs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('disc_code', sa.String(20), unique=True, nullable=False, index=True),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('manufacturer', sa.String(100), nullable=True),
        sa.Column('mold', sa.String(100), nullable=False),
        sa.Column('plastic', sa.String(100), nullable=True),
        sa.Column('weight_grams', sa.Integer(), nullable=True),
        sa.Column('color', sa.String(50), nullable=True),
        sa.Column('photo_url', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('registered_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Disc Found Reports ===
    op.create_table(
        'disc_found_reports',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('disc_id', sa.Integer(), sa.ForeignKey('registered_discs.id'), nullable=False),
        sa.Column('finder_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('finder_name', sa.String(100), nullable=False),
        sa.Column('finder_contact', sa.String(200), nullable=True),
        sa.Column('found_location', sa.String(300), nullable=True),
        sa.Column('found_lat', sa.Float(), nullable=True),
        sa.Column('found_lng', sa.Float(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('found_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('resolved', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )

    # === Disc Messages ===
    op.create_table(
        'disc_messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('disc_id', sa.Integer(), sa.ForeignKey('registered_discs.id'), nullable=False),
        sa.Column('sender_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('sender_name', sa.String(100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('disc_messages')
    op.drop_table('disc_found_reports')
    op.drop_table('registered_discs')
    op.drop_table('putt_attempts')
    op.drop_table('prizes')
    op.drop_table('results')
    op.drop_table('team_members')
    op.drop_table('teams')
    op.drop_table('events')
    op.drop_table('leagues')
    op.drop_table('hole_scores')
    op.drop_table('rounds')
    op.drop_table('course_features')
    op.drop_index('idx_holes_fairway_line', table_name='holes')
    op.drop_index('idx_holes_basket_position', table_name='holes')
    op.drop_index('idx_holes_tee_position', table_name='holes')
    op.drop_table('holes')
    op.drop_table('layouts')
    op.drop_index('idx_courses_boundary', table_name='courses')
    op.drop_table('courses')
    op.drop_table('users')
    op.execute("DROP EXTENSION IF EXISTS postgis CASCADE")
