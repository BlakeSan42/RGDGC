"""add sticker tables

Revision ID: 34ac9bf1c5f8
Revises: 474298be8931
Create Date: 2026-03-22 13:51:05.660697
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '34ac9bf1c5f8'
down_revision: Union[str, None] = '474298be8931'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Sticker Orders ===
    op.create_table(
        'sticker_orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('batch_id', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('batch_name', sa.String(100), nullable=False),
        sa.Column('order_type', sa.String(20), server_default='bulk'),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('start_code', sa.String(20), nullable=True),
        sa.Column('end_code', sa.String(20), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # === Sticker Inventory ===
    op.create_table(
        'sticker_inventory',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('sticker_orders.id'), nullable=False),
        sa.Column('disc_code', sa.String(20), unique=True, nullable=False, index=True),
        sa.Column('qr_url', sa.String(200), nullable=False),
        sa.Column('status', sa.String(20), server_default='available'),
        sa.Column('claimed_by_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('claimed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('sticker_inventory')
    op.drop_table('sticker_orders')
