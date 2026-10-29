# Measurement contract

Copyright © 2026 Christopher Snow.

## The question

How do the elapsed times of two traversal orders compare for repeated sums of a
row-major grid in this browser, with this Wasm source and this input size?

This is a microbenchmark of a scalar loop, not a benchmark of an application or
native C. The illustrative pseudocode is not compiled. `src/kernel.wat` is the
actual default source compiled by pinned WABT 1.0.39. The engine may optimise it;
the lab does not expose or claim a particular native instruction sequence.

## Input and equal work

The grid has n × n unsigned 32-bit integers, where n is 64, 256, 1,024 or 2,048.
The value at linear index i is i modulo 251. Allocation and filling happen before
timing. The imported memory has a maximum of 256 Wasm pages (16 MiB).

One function takes n, passes, inner stride and outer stride. Row traversal uses
inner 1 and outer n; column traversal uses inner n and outer 1. Both use the same
loop and visit each cell once per pass. The accumulator persists across passes and
wraps modulo 2^32. JavaScript computes the expected fixture sum independently;
`Math.imul(sum, passes) >>> 0` computes the expected batch checksum.

The editor permits arbitrary WAT. A matching checksum is only a check on this
fixture, not a proof of work equivalence. A constant-returning program, or one
using known properties of the fixture, could return the expected sum without
performing the intended reads. The original-source comparisons are the supported
equal-work experiment. Edited source and its hash travel with the result.

## Timing procedure

1. Instantiate in a dedicated worker and prepare input outside the timer.
2. Warm both orders for at least four pairs, aiming for 100 ms, with a maximum
   of 1,000 pairs. This reduces startup effects; it does not prove that tiering
   has settled.
3. Calibrate the same pass count for both variants by doubling from one. Stop
   when both batches reach 8 ms, either reaches 150 ms, or the count is 4,096.
   These are aims/caps, not guarantees for arbitrary edited source.
4. Discard warm-up and calibration timings. Randomise the first order and
   alternate the first order on each subsequent pair. Sample 10, 20 or 40 pairs.
5. Time each single Wasm call with `performance.now()`. Check its returned
   checksum after stopping the timer. Include loop overhead and the JS/Wasm
   call. Exclude compilation, setup, correctness checks, reporting and drawing.
6. Report batch milliseconds and milliseconds per complete grid pass. Keep
   every sample; do not trim outliers. Plot the raw normalised samples on one
   shared linear scale and report each median and their ratio.

Repeated passes operate on the same grid. The experiment is deliberately warmed;
there is no cache flush. Sample timings may be dependent and may include tier
changes, scheduling interruptions or thermal/power effects. Alternation balances
simple order effects but does not eliminate them. Normalised per-pass time is an
average over a batch, not a directly timed individual pass.

The record's timer-resolution field is the minimum positive observed increment
in a short probe. It is not a guaranteed clock resolution. Zero-duration batches
are rejected. The median ratio is descriptive; no significance or confidence
claim is made. Cache misses, TLB misses and native instructions are not measured.

## Failure and state

A failed checksum stops the attempt. Compilation errors are shown verbatim as
text. A Stop button terminates the worker, including a looping module. A 30-second
wall-clock timer covers startup, compilation, warm-up and measurement. Hiding the
tab terminates an active run. Interrupted attempts do not yield accepted samples.
If a previous successful result exists, it remains identified by its settings and
timestamp; an interrupted new attempt does not overwrite it.

Editing source or controls marks retained results stale. JSON download always
uses the retained result's immutable settings, never current editor state.
Source/settings/notes use app-prefixed localStorage keys. Storage failure leaves
the editor usable and gives a download reminder. Results are in memory only.

## Validation

`tests/lab.spec.ts` runs the real compiled Wasm at tiny, irregular and UI-supported
sizes, with repeated passes and wraparound. Browser tests run the production build
under `/benchmarking-lab/`, inspect real samples and exported conditions, exercise
incorrect and malformed source, cancellation of a real infinite loop, the timeout
path, recovery, saved drafts, keyboard stepping, phone layout, dark theme and the
no-JavaScript reading path. No performance ratio is asserted.

Tests establish the checked behaviours on the tested browser. They do not replace
reader trials or certify other devices' performance. The UI leaves its interpretation
open to the measured result rather than grading a predetermined winner.
