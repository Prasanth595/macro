-- no-transaction

-- Microsoft Graph lists a meeting's organizer as an attendee who has not
-- answered, so every Outlook event stored before October 2026 holds its
-- organizer's row as needs_action, and Macro asked the organizer whether they
-- were going to their own meeting. Sync now stores that row as accepted, but
-- Graph's delta resends only events that changed, so rewrite the stored rows
-- the same way: the entity's and its occurrences' attendees, and every Outlook
-- copy's stored projection a restore would replay. Each event's inbox logs an
-- upsert so calendar caches refetch it. One read finds the events, then each
-- batch commits on its own with its counter locks taken in link order, as
-- every calendar write takes them. A rerun rewrites nothing twice and logs
-- only events still to fix.
-- Keep this file a single statement: COMMIT inside DO needs a top-level call.
DO $$
DECLARE
    batch_size CONSTANT integer := 1000;
    link_ids uuid[];
    event_ids uuid[];
    batch_start integer := 1;
    batch_end integer;
    batch_events uuid[];
    link_batch record;
    last_seq bigint;
BEGIN
    SELECT COALESCE(array_agg(event.source_link_id ORDER BY event.source_link_id, event.id), '{}'),
           COALESCE(array_agg(event.id ORDER BY event.source_link_id, event.id), '{}')
    INTO link_ids, event_ids
    FROM calendar_events event
    WHERE event.canonical_source_kind = 'outlook'
      AND (
            EXISTS (
                SELECT 1 FROM calendar_event_attendees attendee
                WHERE attendee.event_id = event.id
                  AND attendee.is_organizer
                  AND attendee.response_status = 'needs_action'
            )
            OR EXISTS (
                SELECT 1 FROM calendar_event_override_attendees attendee
                WHERE attendee.event_id = event.id
                  AND attendee.is_organizer
                  AND attendee.response_status = 'needs_action'
            )
      );
    COMMIT;

    WHILE batch_start <= cardinality(event_ids) LOOP
        batch_end := least(batch_start + batch_size - 1, cardinality(event_ids));
        batch_events := event_ids[batch_start:batch_end];

        UPDATE calendar_event_attendees attendee
        SET response_status = 'accepted'
        WHERE attendee.event_id = ANY(batch_events)
          AND attendee.is_organizer
          AND attendee.response_status = 'needs_action';
        UPDATE calendar_event_override_attendees attendee
        SET response_status = 'accepted'
        WHERE attendee.event_id = ANY(batch_events)
          AND attendee.is_organizer
          AND attendee.response_status = 'needs_action';
        UPDATE calendar_event_sources source
        SET normalized_payload = jsonb_set(
                source.normalized_payload,
                '{event,attendees}',
                (
                    SELECT jsonb_agg(
                        CASE
                            WHEN listed.attendee @> '{"isOrganizer": true, "responseStatus": "needs_action"}'
                                THEN listed.attendee || '{"responseStatus": "accepted"}'
                            ELSE listed.attendee
                        END
                        ORDER BY listed.position
                    )
                    FROM jsonb_array_elements(source.normalized_payload -> 'event' -> 'attendees')
                        WITH ORDINALITY AS listed(attendee, position)
                )
            )
        WHERE source.event_id = ANY(batch_events)
          AND source.source_kind = 'outlook'
          AND source.normalized_payload -> 'event' -> 'attendees'
              @> '[{"isOrganizer": true, "responseStatus": "needs_action"}]';
        UPDATE calendar_event_sources source
        SET normalized_payload = jsonb_set(
                source.normalized_payload,
                '{overrides}',
                (
                    SELECT jsonb_agg(
                        CASE
                            WHEN jsonb_typeof(exception.body -> 'attendees') = 'array' THEN jsonb_set(
                                exception.body,
                                '{attendees}',
                                (
                                    SELECT COALESCE(
                                        jsonb_agg(
                                            CASE
                                                WHEN listed.attendee @> '{"isOrganizer": true, "responseStatus": "needs_action"}'
                                                    THEN listed.attendee || '{"responseStatus": "accepted"}'
                                                ELSE listed.attendee
                                            END
                                            ORDER BY listed.position
                                        ),
                                        '[]'::jsonb
                                    )
                                    FROM jsonb_array_elements(exception.body -> 'attendees')
                                        WITH ORDINALITY AS listed(attendee, position)
                                )
                            )
                            ELSE exception.body
                        END
                        ORDER BY exception.position
                    )
                    FROM jsonb_array_elements(source.normalized_payload -> 'overrides')
                        WITH ORDINALITY AS exception(body, position)
                )
            )
        WHERE source.event_id = ANY(batch_events)
          AND source.source_kind = 'outlook'
          AND jsonb_path_exists(
                source.normalized_payload,
                '$.overrides[*].attendees[*] ? (@.isOrganizer == true && @.responseStatus == "needs_action")'
          );

        FOR link_batch IN
            SELECT batch.link_id, array_agg(batch.event_id ORDER BY batch.position) AS events
            FROM unnest(link_ids[batch_start:batch_end], batch_events)
                WITH ORDINALITY AS batch(link_id, event_id, position)
            GROUP BY batch.link_id
            ORDER BY batch.link_id
        LOOP
            INSERT INTO calendar_change_counters (link_id, seq)
            VALUES (link_batch.link_id, cardinality(link_batch.events))
            ON CONFLICT (link_id) DO UPDATE
            SET seq = calendar_change_counters.seq + EXCLUDED.seq,
                updated_at = now()
            RETURNING seq INTO last_seq;
            INSERT INTO calendar_change_log (link_id, seq, kind, event_id)
            SELECT link_batch.link_id,
                   last_seq - cardinality(link_batch.events) + logged.position,
                   1,
                   logged.event_id
            FROM unnest(link_batch.events) WITH ORDINALITY AS logged(event_id, position);
        END LOOP;
        COMMIT;
        batch_start := batch_end + 1;
    END LOOP;

    RAISE NOTICE 'marked the organizers of % Outlook events as holding them',
        cardinality(event_ids);
END $$;
