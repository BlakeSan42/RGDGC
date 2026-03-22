"""add missing tables and columns

Revision ID: d8f2e3a41b5c
Revises: c7e3a1d92f4b
Create Date: 2026-03-22 18:00:00.000000

Adds bio, push_token, push_platform to users.
Creates league_members, audit_logs, announcements tables.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID


revision: str = 'd8f2e3a41b5c'
down_revision: Union[str, None] = 'c7e3a1d92f4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users: add missing columns ---
    op.add_column('users', sa.Column('bio', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('push_token', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('push_platform', sa.String(10), nullable=True))

    # --- league_members ---
    op.create_table(
        'league_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('league_id', UUID(as_uuid=True), sa.ForeignKey('leagues.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('joined_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.UniqueConstraint('league_id', 'user_id', name='uq_league_members_league_user'),
    )

    # --- audit_logs ---
    op.create_table(
        'audit_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('admin_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=False),
        sa.Column('target_id', sa.String(255), nullable=False),
        sa.Column('details', JSON, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_audit_logs_action_created_at', 'audit_logs', ['action', 'created_at'])

    # --- announcements ---
    op.create_table(
        'announcements',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('author_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('priority', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('announcements')
    op.drop_index('ix_audit_logs_action_created_at', table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_table('league_members')
    op.drop_column('users', 'push_platform')
    op.drop_column('users', 'push_token')
    op.drop_column('users', 'bio')
