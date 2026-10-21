-- The delivery project created when a deal is won. The deal keeps the
-- commercial outcome; this id is only the link to that project.
ALTER TABLE crm_deals
    ADD COLUMN delivery_initiative_id UUID;

CREATE UNIQUE INDEX crm_deals_delivery_initiative_id_idx
    ON crm_deals (delivery_initiative_id)
    WHERE delivery_initiative_id IS NOT NULL;
