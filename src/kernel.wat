;; Copyright © 2026 Christopher Snow
;; The same scalar loop runs both traversal orders.
;; Row order: inner = 1, outer = n. Column order: inner = n, outer = 1.
(module
  (import "env" "memory" (memory 1 256))
  (func (export "scan")
    (param $n i32) (param $passes i32)
    (param $inner i32) (param $outer i32)
    (result i32)
    (local $p i32) (local $row i32) (local $col i32) (local $sum i32)
    (loop $repeat
      (local.set $row (i32.const 0))
      (loop $rows
        (local.set $col (i32.const 0))
        (loop $columns
          (local.set $sum
            (i32.add (local.get $sum)
              (i32.load
                (i32.mul (i32.const 4)
                  (i32.add
                    (i32.mul (local.get $row) (local.get $outer))
                    (i32.mul (local.get $col) (local.get $inner)))))))
          (local.set $col (i32.add (local.get $col) (i32.const 1)))
          (br_if $columns (i32.lt_u (local.get $col) (local.get $n))))
        (local.set $row (i32.add (local.get $row) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $row) (local.get $n))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br_if $repeat (i32.lt_u (local.get $p) (local.get $passes))))
    (local.get $sum))
)
