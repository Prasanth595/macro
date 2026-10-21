DROP INDEX IF EXISTS crm_deals_delivery_initiative_id_idx;

ALTER TABLE crm_deals
    DROP COLUMN IF EXISTS delivery_initiative_id;
