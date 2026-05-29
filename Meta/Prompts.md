# Knowledge Base Prompts

This file contains reusable prompts for maintaining the knowledge base.

---

# Prompt 1: Create New Topic

Use this prompt when the topic does not already exist in the knowledge base.

## Purpose

Convert a ChatGPT conversation into a new, structured knowledge-base article.

## Prompt

```text
You are helping me build a long-term personal knowledge base.

Convert this entire conversation into a production-quality Markdown document.

Requirements:

- Remove conversational content.
- Remove duplicate information.
- Organize logically.
- Add missing context where useful.
- Include examples.
- Include code snippets if relevant.
- Include best practices.
- Include interview questions.
- Include common mistakes.
- Include related topics.
- Include revision notes.

Output structure:

# Topic Name

## Overview

## Core Concepts

## Detailed Explanation

## Examples

## Best Practices

## Common Mistakes

## Interview Questions

## Related Topics

## Revision Notes

Output Markdown only.
```

---

# Prompt 2: Update Existing Topic

Use this prompt when a note already exists and you want to merge new learnings into it.

## Purpose

Keep a single source of truth for each topic and avoid duplicate notes.

## Prompt

```text
I already have a knowledge-base article on this topic.

Existing article:

<PASTE CURRENT MARKDOWN FILE>

New conversation:

<PASTE NEW CHAT OR NEW CONTENT>

Task:

1. Compare the existing article and new conversation.
2. Identify genuinely new information.
3. Identify outdated information.
4. Identify sections that need expansion.
5. Merge the knowledge.
6. Return the COMPLETE updated markdown document.
7. Avoid duplicates.
8. Preserve existing structure where possible.
9. Improve explanations when new information is better.
10. Update interview questions if needed.
11. Update revision notes if needed.

Output the final merged markdown only.
```

---

# Recommended Workflow

```text
ChatGPT Conversation
        ↓
Identify Topic
        ↓
Topic Exists?
        ↓
     YES / NO
      ↓      ↓
Update    Create
Prompt    Prompt
      ↓
Markdown
      ↓
GitHub
      ↓
Obsidian
```

---

# Example

## New Topic

Conversation:

Node.js Event Loop

Knowledge Base:

No existing note

Action:

Use "Prompt 1: Create New Topic"

Output:

```text
Learning/Backend/NodeJS Event Loop.md
```

---

## Existing Topic

Conversation:

Advanced Event Loop Behavior in Node.js 22

Knowledge Base:

```text
Learning/Backend/NodeJS Event Loop.md
```

already exists.

Action:

Use "Prompt 2: Update Existing Topic"

Output:

Updated:

```text
Learning/Backend/NodeJS Event Loop.md
```

No new file is created.

---

# Knowledge Base Rule

Never organize by chat.

Always organize by topic.

Wrong:

```text
Chat-1.md
Chat-2.md
Chat-3.md
```

Correct:

```text
NodeJS Event Loop.md
Streams.md
Worker Threads.md
Kubernetes.md
RAG.md
```

Each topic should have a single evolving source of truth.
