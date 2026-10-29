# Course progression

Copyright © 2026 Christopher Snow.

The reader can recognise a loop and an array. No Wasm experience is required to
run the initial experiment. Advanced source editing is optional. The goal is to
make and defend a performance claim from observed evidence.

| Chapter                         | Question                                                                      | Status      |
| ------------------------------- | ----------------------------------------------------------------------------- | ----------- |
| 1. Same work, different order   | Does traversal order change the time to sum a grid?                           | Implemented |
| 2. What does a timer measure?   | Is the work long enough for this clock, and what belongs inside the interval? | Planned     |
| 3. Warm-up and repeated runs    | Why can a second run differ from the first?                                   | Planned     |
| 4. Noise and comparisons        | How much does the conclusion depend on which samples we kept?                 | Planned     |
| 5. Branches and input data      | Does an algorithm's input distribution change its performance?                | Planned     |
| 6. Doing several things at once | When does Wasm SIMD help, and how do we check the work stays equivalent?      | Planned     |
| 7. Allocation and reuse         | Are we measuring useful work, setup or allocation?                            | Planned     |
| 8. A benchmark you can defend   | Can another reader reproduce and challenge the conclusion?                    | Planned     |

Each chapter needs a concrete question, a small runnable example, an observation
target, an independent task, progressive hints and an explicit account of what
the evidence establishes. Do not impose ten repeated headings or compulsory
prediction forms. Keep a straightforward reading path available before execution.

Before expanding, try chapter 1 with readers: can they explain the two address
orders, distinguish a model from a measurement, identify the timed region, and
state a conditional conclusion from their own run? A successful automated test
does not answer those teaching questions.

Potential later facilities include native companion benchmarks, comparison of
saved runs, explicit cold/warm experiments, and offline use. These need their own
measurement and state contracts. No unfinished feature is exposed as a working lab.
