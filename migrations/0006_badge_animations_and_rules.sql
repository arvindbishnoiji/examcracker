-- Additive columns on badge_definitions for preset + custom code animations
-- and structured automatic unlock rules ("Kaise milega").
ALTER TABLE badge_definitions ADD COLUMN animation_preset TEXT NOT NULL DEFAULT 'shimmer';
ALTER TABLE badge_definitions ADD COLUMN animation_code TEXT NOT NULL DEFAULT '';
ALTER TABLE badge_definitions ADD COLUMN auto_rule TEXT NOT NULL DEFAULT '{}';
