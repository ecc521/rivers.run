-- Re-ID the four rivers whose IDs were USGS gauge IDs, so they stop shadowing
-- the standalone gauge pages. gauge_id columns and gauges JSON are untouched.

-- Sugar River, Lower
UPDATE community_list_rivers SET river_id = '8mj79p8h6y' WHERE river_id = 'USGS:05436500';
UPDATE river_suggestions SET proposed_changes = json_set(proposed_changes, '$.id', '8mj79p8h6y'), river_id = '8mj79p8h6y' WHERE river_id = 'USGS:05436500';
UPDATE river_audit_log SET river_id = '8mj79p8h6y' WHERE river_id = 'USGS:05436500';
INSERT INTO river_audit_log (river_id, action_type, changed_by, changed_at, diff_patch)
    VALUES ('8mj79p8h6y', 'UPDATE', NULL, CAST(strftime('%s', 'now') AS INTEGER),
            json_object('id', json_object('old', 'USGS:05436500', 'new', '8mj79p8h6y'), 'note', 'Re-ID: river ID collided with gauge ID'));
UPDATE rivers SET id = '8mj79p8h6y' WHERE id = 'USGS:05436500';

-- Sugar River, Upper
UPDATE community_list_rivers SET river_id = '4uc90jfx4r' WHERE river_id = 'USGS:05435950';
UPDATE river_suggestions SET proposed_changes = json_set(proposed_changes, '$.id', '4uc90jfx4r'), river_id = '4uc90jfx4r' WHERE river_id = 'USGS:05435950';
UPDATE river_audit_log SET river_id = '4uc90jfx4r' WHERE river_id = 'USGS:05435950';
INSERT INTO river_audit_log (river_id, action_type, changed_by, changed_at, diff_patch)
    VALUES ('4uc90jfx4r', 'UPDATE', NULL, CAST(strftime('%s', 'now') AS INTEGER),
            json_object('id', json_object('old', 'USGS:05435950', 'new', '4uc90jfx4r'), 'note', 'Re-ID: river ID collided with gauge ID'));
UPDATE rivers SET id = '4uc90jfx4r' WHERE id = 'USGS:05435950';

-- Kickapoo River, Upper
UPDATE community_list_rivers SET river_id = '26jdcv4opp' WHERE river_id = 'USGS:05407468';
UPDATE river_suggestions SET proposed_changes = json_set(proposed_changes, '$.id', '26jdcv4opp'), river_id = '26jdcv4opp' WHERE river_id = 'USGS:05407468';
UPDATE river_audit_log SET river_id = '26jdcv4opp' WHERE river_id = 'USGS:05407468';
INSERT INTO river_audit_log (river_id, action_type, changed_by, changed_at, diff_patch)
    VALUES ('26jdcv4opp', 'UPDATE', NULL, CAST(strftime('%s', 'now') AS INTEGER),
            json_object('id', json_object('old', 'USGS:05407468', 'new', '26jdcv4opp'), 'note', 'Re-ID: river ID collided with gauge ID'));
UPDATE rivers SET id = '26jdcv4opp' WHERE id = 'USGS:05407468';

-- Wisconsin River, Lower
UPDATE community_list_rivers SET river_id = 'ccg3bes7hl' WHERE river_id = 'USGS:05407000';
UPDATE river_suggestions SET proposed_changes = json_set(proposed_changes, '$.id', 'ccg3bes7hl'), river_id = 'ccg3bes7hl' WHERE river_id = 'USGS:05407000';
UPDATE river_audit_log SET river_id = 'ccg3bes7hl' WHERE river_id = 'USGS:05407000';
INSERT INTO river_audit_log (river_id, action_type, changed_by, changed_at, diff_patch)
    VALUES ('ccg3bes7hl', 'UPDATE', NULL, CAST(strftime('%s', 'now') AS INTEGER),
            json_object('id', json_object('old', 'USGS:05407000', 'new', 'ccg3bes7hl'), 'note', 'Re-ID: river ID collided with gauge ID'));
UPDATE rivers SET id = 'ccg3bes7hl' WHERE id = 'USGS:05407000';
