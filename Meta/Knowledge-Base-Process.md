# Knowledge Base Process

## Goal

Build a personal knowledge base from ChatGPT conversations, learning sessions, interview preparation, work experience, and research.

The knowledge base should become the single source of truth for all learning.

---

## Core Principle

Do NOT store chats.

Store knowledge.

Wrong:

- Chat-1.md
- Chat-2.md
- Chat-3.md

Correct:

- Event Loop.md
- Streams.md
- Kubernetes.md
- RAG.md

Each topic should have one primary document that evolves over time.

---

## Workflow

1. Complete a ChatGPT conversation.
2. Identify the topic.
3. Check whether a note for that topic already exists.
4. If it exists:
   - Update the existing note.
   - Do not create a new note.

5. If it does not exist:
   - Create a new topic note.

6. Commit changes to GitHub.

---

## Note Types

Every major topic should contain:

### Main Note

Example:

Event Loop.md

Purpose:

- Complete reference
- Deep explanations
- Examples
- Best practices
- Interview questions

### Revision Note

Example:

Event Loop Revision.md

Purpose:

- Quick revision
- Important concepts
- Common interview questions
- Frequently forgotten details

---

## Linking

Use Obsidian links.

Example:

Related:

- [[Streams]]
- [[libuv]]
- [[Worker Threads]]

---

## Review Cycle

Review important notes every 3–6 months.

Update outdated content.

Add new learnings.

---

## Long-Term Goal

Use the knowledge base as:

- Learning repository
- Interview preparation repository
- Career growth repository
- Input source for a future personal RAG system

## Prompt for new topic creation

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
