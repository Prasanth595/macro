-- Fixture for correspondent ranking and open threads (correspondence.rs).
-- Owner owner@acme.example writes with:
--   t1  Ana (client): sent 01-10, received 01-11, sent 01-12, received 01-18,
--       plus an unsent draft 01-19. Waiting on the owner.
--   t2  a newsletter that only ever wrote in (01-19). Not a correspondent,
--       and not open: the owner never wrote in it.
--   t3  Bob (vendor): sent 01-14, no reply. Waiting on Bob.
--   t4  Ana: sent 01-19, too recent to be waiting on her.
--   t5  Bob in 2024, outside the window.
--   t6  Ana starts a new thread 01-16 that Gmail marks important (signal).
--       Waiting on the owner although the owner never wrote in it.

INSERT INTO email_links (id, macro_id, fusionauth_user_id, email_address, provider, is_sync_active, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-00000000c001', 'macro|owner@acme.example', '00000000-0000-0000-0000-00000000c001',
        'owner@acme.example', 'GMAIL', true, NOW(), NOW());

INSERT INTO email_contacts (id, link_id, email_address, name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-0000000cc001', '00000000-0000-0000-0000-00000000c001', 'Ana@Client.example', NULL, NOW(), NOW()),
       ('00000000-0000-0000-0000-0000000cc002', '00000000-0000-0000-0000-00000000c001', 'news@letters.example', 'Letters', NOW(), NOW()),
       ('00000000-0000-0000-0000-0000000cc003', '00000000-0000-0000-0000-00000000c001', 'bob@vendor.example', 'Bob Vendor', NOW(), NOW()),
       ('00000000-0000-0000-0000-0000000cc004', '00000000-0000-0000-0000-00000000c001', 'owner@acme.example', 'Owner', NOW(), NOW());

INSERT INTO email_threads (id, link_id, inbox_visible, is_read, latest_inbound_message_ts, latest_outbound_message_ts, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001', true, false,
        '2025-01-18 10:00:00+00', '2025-01-19 10:00:00+00', NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000c001', true, false,
        '2025-01-19 10:00:00+00', NULL, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-00000000c001', false, true,
        NULL, '2025-01-14 10:00:00+00', NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c104', '00000000-0000-0000-0000-00000000c001', false, true,
        NULL, '2025-01-19 10:00:00+00', NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c105', '00000000-0000-0000-0000-00000000c001', false, true,
        '2024-01-02 10:00:00+00', '2024-01-01 10:00:00+00', NOW(), NOW());

INSERT INTO email_threads (id, link_id, inbox_visible, is_read, is_signal, latest_inbound_message_ts, latest_outbound_message_ts, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-00000000c106', '00000000-0000-0000-0000-00000000c001', true, false, true,
        '2025-01-16 10:00:00+00', NULL, NOW(), NOW());

INSERT INTO email_messages (id, thread_id, link_id, is_sent, is_draft, from_contact_id, from_name, subject, internal_date_ts,
                            has_attachments, is_read, is_starred, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-00000000c201', '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001',
        true, false, '00000000-0000-0000-0000-0000000cc004', 'Owner', 'Proposal', '2025-01-10 10:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c202', '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001',
        false, false, '00000000-0000-0000-0000-0000000cc001', 'Ana Ruiz', 'Re: Proposal', '2025-01-11 10:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c203', '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001',
        true, false, '00000000-0000-0000-0000-0000000cc004', 'Owner', 'Re: Proposal', '2025-01-12 10:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c204', '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001',
        false, false, '00000000-0000-0000-0000-0000000cc001', 'Ana Ruiz', 'Re: Proposal', '2025-01-18 10:00:00+00', false, false, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c205', '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001',
        false, true, '00000000-0000-0000-0000-0000000cc004', 'Owner', 'Re: Proposal', '2025-01-19 12:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c206', '00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000c001',
        false, false, '00000000-0000-0000-0000-0000000cc002', 'Letters', 'This week', '2025-01-19 10:00:00+00', false, false, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c207', '00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-00000000c001',
        true, false, '00000000-0000-0000-0000-0000000cc004', 'Owner', 'Invoice', '2025-01-14 10:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c208', '00000000-0000-0000-0000-00000000c104', '00000000-0000-0000-0000-00000000c001',
        true, false, '00000000-0000-0000-0000-0000000cc004', 'Owner', 'Kickoff', '2025-01-19 10:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c209', '00000000-0000-0000-0000-00000000c105', '00000000-0000-0000-0000-00000000c001',
        true, false, '00000000-0000-0000-0000-0000000cc004', 'Owner', 'Old', '2024-01-01 10:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c210', '00000000-0000-0000-0000-00000000c105', '00000000-0000-0000-0000-00000000c001',
        false, false, '00000000-0000-0000-0000-0000000cc003', 'Bob Vendor', 'Re: Old', '2024-01-02 10:00:00+00', false, true, false, NOW(), NOW()),
       ('00000000-0000-0000-0000-00000000c211', '00000000-0000-0000-0000-00000000c106', '00000000-0000-0000-0000-00000000c001',
        false, false, '00000000-0000-0000-0000-0000000cc001', 'Ana Ruiz', 'Contract', '2025-01-16 10:00:00+00', false, false, false, NOW(), NOW());

INSERT INTO email_message_recipients (message_id, contact_id, recipient_type)
VALUES ('00000000-0000-0000-0000-00000000c201', '00000000-0000-0000-0000-0000000cc001', 'TO'),
       ('00000000-0000-0000-0000-00000000c202', '00000000-0000-0000-0000-0000000cc004', 'TO'),
       ('00000000-0000-0000-0000-00000000c203', '00000000-0000-0000-0000-0000000cc001', 'TO'),
       ('00000000-0000-0000-0000-00000000c204', '00000000-0000-0000-0000-0000000cc004', 'TO'),
       ('00000000-0000-0000-0000-00000000c205', '00000000-0000-0000-0000-0000000cc001', 'TO'),
       ('00000000-0000-0000-0000-00000000c206', '00000000-0000-0000-0000-0000000cc004', 'TO'),
       ('00000000-0000-0000-0000-00000000c207', '00000000-0000-0000-0000-0000000cc003', 'TO'),
       ('00000000-0000-0000-0000-00000000c208', '00000000-0000-0000-0000-0000000cc001', 'TO'),
       ('00000000-0000-0000-0000-00000000c209', '00000000-0000-0000-0000-0000000cc003', 'TO'),
       ('00000000-0000-0000-0000-00000000c210', '00000000-0000-0000-0000-0000000cc004', 'TO'),
       ('00000000-0000-0000-0000-00000000c211', '00000000-0000-0000-0000-0000000cc004', 'TO');
