-- Sessions earlier routine runs created, from the routines' run history.
SET LOCAL lock_timeout = '5s';
UPDATE agent_session AS s
SET source = 'routine'
FROM action_execution_record AS r
WHERE r.resource_id = s.id::text
  AND s.source <> 'routine';
