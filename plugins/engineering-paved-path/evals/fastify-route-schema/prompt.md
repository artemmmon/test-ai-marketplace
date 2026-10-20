---
description: A new Fastify route should use a plugin, JSON Schema for input and output, framework error handling and inject() in tests.
tags: [fastify, design]
max_turns: 8
allowed_tools: [Skill, Read, Glob, Grep]
---

Write a Fastify plugin in TypeScript that registers two routes on an in-memory store (a `Map`):

- `POST /notes` with a JSON body `{ title: string (1 to 100 characters, required), text?: string }`.
  It returns 201 with the created note `{ id, title, text }`.
- `GET /notes/:id` returns the note, or a 404 JSON error when the id is unknown.

Add one test for the 404 case. Show the code in your answer; do not create files.
