-- Offline tag handles are scoped to the authenticated caller, never accepted
-- as primary keys in shared definition/option tables. Keep bindings after a
-- target is deleted so replay cannot recreate it. Account deletion owns cleanup.
CREATE TABLE property_definition_client_ids (
    user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    client_id UUID NOT NULL,
    property_definition_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, client_id)
);

CREATE TABLE property_option_client_ids (
    user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    client_id UUID NOT NULL,
    property_definition_id UUID NOT NULL,
    option_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, client_id)
);
