# Selecting the strongest patterns

Copyright © 2026 Christopher Snow.

Review date: 29 October 2026. The owner requested review of Assembly Lab, Digital
Design, Video Lab, Metadata Book, Metadata Systems and GPU Lab. This record covers
their READMEs, representative lesson sources, teaching/design notes, and the
published pages listed below. It is a source and interface review, not a learner
usability study or a full audit of every chapter.

## The selections

| Book and reviewed example                                                                                                   | Strongest feature                                                                                                                 | Choice for Benchmarking Lab                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Assembly Lab: compile a loop](https://snowch.github.io/assembly-lab/#/lesson/compile-a-loop)                               | Source next to execution, editable boundary cases, diagnostics that distinguish incomplete execution from a returned result       | Keep the real WAT source inspectable/editable. Put address order beside an illustrative loop. Treat cancellation and timeout as incomplete attempts.                                                |
| [Digital Design: how a circuit remembers](https://snowch.github.io/digital-design/#/lesson/remember)                        | Mechanisms exposed through stepping; deliberate faults; five hints from concept to solution                                       | Step individual address reads. Break the accumulator, inspect the checksum diagnostic, then repair it. Offer a five-stage hint ladder.                                                              |
| [Video Lab: keep a shorter section](https://snowch.github.io/video-lab/#/learn/first-edit/shorten)                          | A concrete outcome, complete editable command, nearby explanation, actual output, a specific observation and one independent task | One visible experiment owns its code, controls and samples. Retain raw output and flag stale results. Predictions are optional thinking prompts; never block execution.                             |
| [Metadata Book: what the data cannot tell you](https://snowch.github.io/metadata-book/chapters/01-why-metadata.html)        | Readable narrative, quiet typography, visible definitions and evidence at the claim                                               | Use a reading-first layout, a narrow prose column, inline definitions and a conditions record. Keep essential explanations visible without running code.                                            |
| [Metadata Systems: the shop and its platform](https://snowch.github.io/metadata-systems/) and `notebook/chapter_01.py`      | A continuing concrete investigation; executable evidence; saved learner edits                                                     | Begin with a specific question about a sum. Keep code, settings and notes locally. Export a complete run record rather than a screenshot of a score. Future chapters deepen the same investigation. |
| [GPU Lab: one operation, many numbers](https://snowch.github.io/gpu-lab/lessons/hello.html) and `docs/chapter-migration.md` | Each experiment keeps independent state; small visual steps; explicit separation of simulation and hardware execution             | Address exploration and timed execution have separate state. Label the former explanatory and the latter measured. A changed setting invalidates the measured result without silently rewriting it. |

Video Lab's `docs/notes/lesson-flow/01-plan.md` explicitly removes compulsory
prediction/review entry and blanket repeated sections. This is the best current
pattern for the new book. Predictions can help readers notice a surprise, but
requiring a form submission before every experiment interrupts reading.

Metadata Book supplies the strongest reading layout. GPU Lab supplies the strongest
small visual progression. Video Lab supplies the strongest execution flow. Assembly
Lab and Digital Design add inspection and diagnosis. Metadata Systems adds a coherent
investigation and evidence that can be kept.

## What the first chapter implements

The chapter introduces two equal-work traversals of one grid. A small address
explorer explains the indexing, then a worker runs the actual Wasm. All timing
values derive from that run. Text explains the median only when the reader needs
to interpret the samples. One independent task compares two working-set sizes;
a separate optional fault exercise demonstrates why correctness comes first.

The chapter stays readable without JavaScript. It offers light/dark themes,
keyboard-operable controls, phone layouts and a text table for the plotted samples.
Code, settings and notes are local drafts. Exports preserve exactly the source and
settings used for a run even if the editor has since changed.

## Architecture choice

The shared learning platform has a fixed ten-section lesson schema. It is useful
for Digital Design's construction-and-diagnosis lessons. Applying that full shape
here would reintroduce the ceremony Video Lab deliberately removed. GPU Lab already
demonstrates a standalone book that retains the interaction vocabulary without
adopting the runtime.

Use static HTML with small TypeScript modules for this first chapter. Do not change
the shared platform as a side effect of starting another book. Revisit shared
runtime adoption when several benchmarking chapters establish a repeated need.
The current choice is a deliberate small starting point, not a claim of platform
integration.

The initial scope does not include a Jupyter environment, a general C compiler,
offline download/update machinery, a concept map, narrated videos or a full course.
Those patterns have uses in the reference books, but none is necessary to test
whether this first measured lesson works. Later chapters must earn their place
with a distinct question and runnable experiment.

## Source revisions reviewed

| Repository                | Revision                                   |
| ------------------------- | ------------------------------------------ |
| `snowch/assembly-lab`     | `319aae16a5648841e0b68c74e26b433c18253442` |
| `snowch/digital-design`   | `de358a24404331e8c0edb37385f93354179141c0` |
| `snowch/video-lab`        | `bb5ddc218da230ff484ce9c7ddece0b490911c78` |
| `snowch/metadata-book`    | `e5b4f44019ca2f0c5d51b98e2314424cc16bbd17` |
| `snowch/metadata-systems` | `3c04f0b6c8ad3e50b3db2bdde09d49f1cfdf61e6` |
| `snowch/gpu-lab`          | `205c142abb570c1a16c80ad8634b15d133ca870a` |

Additional representative sources: Digital Design's `docs/authoring.md` and
`content/lessons/remember.ts`; Assembly Lab's
`content/lessons/compile-a-loop.prose.ts`; Video Lab's
`src/notebook/pages/first-edit-shorten.ts`; Metadata Book's
`chapters/01-why-metadata.md`; Metadata Systems' `notebook/chapter_01.py`.

The prose and application implementation in Benchmarking Lab are original. The
review borrows interaction and presentation patterns, not source files.
