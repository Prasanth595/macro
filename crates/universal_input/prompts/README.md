# Extraction prompts

All editable extraction instructions live in this folder.

| Files | Used for |
| --- | --- |
| `extract_fields_prompt.txt` | Shared instructions for generative content extraction. |
| `extract_<intent>_prompt.txt` | Intent-specific generative instructions. Search also uses `extract_search_query_prompt.txt`. |
| `typed_<intent>_<field>_prompt.txt` | Individual Clairic field instructions. Its search query uses the same `extract_search_query_prompt.txt`. |
| `temporal_prompt.txt` | Temporal facts, source-span rules, and structured examples. |
| `temporal_task_prompt.txt` | Task-specific deadline instructions appended to the temporal prompt. |
| `temporal_output_prompt.txt` | Output instruction preceding the generated temporal schema. |

Rust assembles these instructions with generated schemas and task-property data.
Prompt files are embedded at compile time; rebuild the harness after editing
them. See the [behavior baseline](../eval/README.md) to compare live predictions.
