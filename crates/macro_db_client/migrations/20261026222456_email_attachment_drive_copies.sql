-- Drive documents a viewer saved from an email attachment. The attachment's
-- own document stays the immutable original and is hidden from Drive.
CREATE TABLE email_attachment_drive_copies
(
    email_attachment_id uuid                     NOT NULL REFERENCES email_attachments (id) ON DELETE CASCADE,
    document_id         text                     NOT NULL REFERENCES "Document" (id) ON DELETE CASCADE,
    owner_id            text                     NOT NULL,
    created_at          timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (email_attachment_id, document_id)
);

-- Copies are listed per viewer. The primary key starts at the attachment, so
-- this index serves the owner filter without scanning other people's copies.
CREATE INDEX email_attachment_drive_copies_owner_idx
    ON email_attachment_drive_copies (email_attachment_id, owner_id);
