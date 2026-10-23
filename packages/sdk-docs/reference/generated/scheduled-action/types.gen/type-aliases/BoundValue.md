# Type Alias: BoundValue

> **BoundValue** = \{ `target`: [`TaskTarget`](TaskTarget.md); `type`: `"agent"`; \} \| \{ `cron`: `string`; `timezone`: `string`; `type`: `"schedule"`; \} \| \{ `text`: `string`; `type`: `"text"`; \} \| \{ `type`: `"user"`; `user_id`: `string`; \} \| \{ `id`: `string`; `name?`: `string`; `type`: `"entity"`; \}

A value for one variable: fixed by the creator, or chosen at activation.
