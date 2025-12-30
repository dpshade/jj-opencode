---
description: "Create a new JJ change and unlock file editing"
argument-hint: "[description] - What you're about to implement"
---

# /jj Command

Create a new JJ change from `main@origin` and unlock the gate for file editing.

## Usage

```
/jj "Add user authentication to the API"
```

## What This Does

1. Runs `jj git fetch` to get latest from remote
2. Runs `jj new main@origin -m "description"` to create a fresh change
3. Unlocks the plugin gate so you can edit files

## Argument

The argument is the description of the work you're about to do. It must be:
- At least 10 characters
- More than one word

## Action

Call the `jj` tool with the provided description:

```
jj(description: "$ARGUMENTS")
```

If no argument provided, ask the user what they want to work on.
