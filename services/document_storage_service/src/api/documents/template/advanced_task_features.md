# Task creation

In addition to creating a task with `c -> t` or by typing `/task`, you can turn any checkbox list into a list of tasks by selecting the rows and clicking the `Tasks` button. Here, try it below:

- [ ] stop
- [ ] drop
- [ ] roll

Similarly, any Channel message can be turned into a task, by hovering the message and clicking the `Task` button.

# GitHub integration

Macro tasks integrate with GitHub. Mention the task id, such as `ENG-42`, anywhere GitHub can see it — the branch name, pull request title, description, or a comment — and Macro links that pull request to the task. There are no magic words. One pull request can name several tasks, and one task can have several pull requests.

To connect your GitHub, go to [the Connections page](https://macro.com/app/settings/connections) in Settings.

The task id is on the task, next to the branch button. You can also copy a branch name, which already contains the id, from under the task title or with `cmd+k` and "Copy branch name".

By default, opening a linked pull request moves the task to “In Review,” merging it moves the task to “Done,” and closing it without merging moves the task back to “Not Started.” A team admin can turn each of those off in Team settings. Linking still happens either way. 

# Macro MCP

[Connect the Macro MCP](https://macro.com/app/settings/mcp-server) to your coding agent to give your agent direct access to your tasks.

# Cloud Agent Integration

In the Info Panel (which lives on the right when there is enough room, or behind the info button in the top-right at narrower width), in the Actions section, you'll find tools for integrating your tasks with outside agents. You can copy the task as a prompt, or even open up a cloud agent with the press of a button.
