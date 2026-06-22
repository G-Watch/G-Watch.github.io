---
title: Designing for Two Readers
description: Why goodoc gives every document two views—humanize and agent.
date: 2026-06-18
tags: [Design, Philosophy]
---

# Designing for Two Readers

The readers of documentation are quietly changing. In the past, almost everyone reading your README was a person; now, more and more of them are
agents—retrieving, summarizing, and answering questions about your project on someone's behalf.

Yet most sites render only for humans. Behind that pretty typography sit layers of nested `div`s, scripts, and styles, and it's not easy for a machine
to reconstruct the content accurately from all that.

## One Set of Content, Two Presentations

goodoc's approach: **the same Markdown, rendered twice.**

- The **humanize** view is optimized for people: literary typography, code highlighting, a table of contents, and a sidebar.
- The **agent** view is optimized for machines: strip away the shell and keep only semantic HTML, with all images and text inlined.

Both come from the same rendering pipeline, so they're always consistent—you never have to maintain two copies of the content.

## Why Not Just Hand Over the Markdown?

Some might say: why not just give machines the raw `.md`? But Markdown often mixes in relative links, unparsed inline
HTML, and images that need a base path. By rendering it uniformly into clean HTML first, the machine receives a structure that's **already parsed and
ready to read**, sparing it the trouble of parsing all over again.

> Good documentation should be comfortable for people to read and clear for machines to understand.

That's the small thing goodoc set out to do.
