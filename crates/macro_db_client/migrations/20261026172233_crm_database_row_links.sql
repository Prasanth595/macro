-- Links are CRM-owned references, never copies of database cells or access grants.
CREATE TABLE crm_database_row_links (
    company_id UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
    pipeline_id UUID REFERENCES crm_pipeline_entities(id) ON DELETE CASCADE,
    entry_row_id UUID REFERENCES database_rows(id) ON DELETE CASCADE,
    source_database_id UUID NOT NULL REFERENCES database_entities(database_id) ON DELETE CASCADE,
    source_table_id UUID NOT NULL REFERENCES database_tables(id) ON DELETE CASCADE,
    source_row_id UUID NOT NULL REFERENCES database_rows(id) ON DELETE CASCADE,
    CHECK (
        (company_id IS NOT NULL AND pipeline_id IS NULL AND entry_row_id IS NULL)
        OR (company_id IS NULL AND pipeline_id IS NOT NULL AND entry_row_id IS NOT NULL)
    ),
    UNIQUE NULLS NOT DISTINCT (company_id, pipeline_id, entry_row_id, source_row_id)
);
CREATE INDEX crm_database_row_links_entry ON crm_database_row_links(pipeline_id, entry_row_id);
CREATE INDEX crm_database_row_links_entry_row ON crm_database_row_links(entry_row_id);
CREATE INDEX crm_database_row_links_source ON crm_database_row_links(source_row_id);
CREATE INDEX crm_database_row_links_database ON crm_database_row_links(source_database_id);
CREATE INDEX crm_database_row_links_table ON crm_database_row_links(source_table_id);
