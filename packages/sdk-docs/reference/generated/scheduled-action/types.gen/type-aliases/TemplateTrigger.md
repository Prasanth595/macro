# Type Alias: TemplateTrigger

> **TemplateTrigger** = \{ `schedule`: [`VariableRef`](VariableRef.md); `type`: `"cron"`; \} \| \{ `filters`: [`TemplateEventFilter`](TemplateEventFilter.md)[]; `type`: `"events"`; \} \| \{ `triggers`: [`TemplateRoutineTrigger`](TemplateRoutineTrigger.md)[]; `type`: `"multiple"`; \}

A routine trigger with variables where values would appear. Mirrors
`ActionTrigger`; a cron entry's schedule and timezone are one variable.
