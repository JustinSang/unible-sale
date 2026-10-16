// lib/calcRules.ts 시험. 실행: node --experimental-strip-types scripts/test_calc_rules.mjs
import assert from 'node:assert/strict';
import { roundBy, normalizeCalc, DEFAULT_CALC } from '../lib/calcRules.ts';

// 1) 기본값 R은 기존 Math.round와 «완전히 같다» — 무작위 20만 개 + 경계값
let n = 0;
for (let i = 0; i < 200000; i++) {
  const x = (Math.random() - 0.3) * 1e7;
  assert.ok(roundBy(x, 'R') === Math.round(x)); n++;   // === 는 0과 -0을 같게 본다(-0 정규화만 다름)
}
for (const x of [0, 0.5, 1.5, 2.5, -0.5, -1.5, 0.49999999, 1e12 + 0.5, 195000, 12345.5]) assert.ok(roundBy(x, 'R') === Math.round(x));

// 2) 내림·올림
assert.equal(roundBy(1.9, 'F'), 1); assert.equal(roundBy(1.1, 'C'), 2);
assert.equal(roundBy(5, 'F'), 5); assert.equal(roundBy(5, 'C'), 5);
// 부동소수 잡음: 0.1*3 은 0.30000000000000004 — 올림이 1이 되면 안 된다. 30*0.1*... 형태의 실제 금액
assert.equal(roundBy(0.1 * 3 * 10, 'C'), 3);            // 3.0000000000000004 → 3
assert.equal(roundBy(1950 * 300 * 0.1, 'F'), 58500);     // 58500.00000000001 류
assert.equal(roundBy(1950 * 300 * 0.1, 'C'), 58500);
assert.equal(roundBy(333 * 0.1, 'F'), 33); assert.equal(roundBy(333 * 0.1, 'C'), 34);
// 2-1) 고액·잡음 경계(저커버그2 지적 반영): 1.1e12 곱셈 오차, 90억 초과, -0
assert.equal(roundBy(1e12 * 1.1, 'C'), 1100000000000);   // 1100000000000.0002 류 잡음 → 정수
assert.equal(roundBy(1e12 * 1.1, 'F'), 1100000000000);
assert.equal(roundBy(1e10 + 0.3, 'F'), 1e10); assert.equal(roundBy(1e10 + 0.3, 'C'), 1e10 + 1);
assert.equal(roundBy(123456789012 + 0.25, 'C'), 123456789013);
assert.equal(roundBy(15 * 0.1, 'F'), 1); assert.equal(roundBy(15 * 0.1, 'C'), 2);   // 1.5 — 진짜 소수는 남는다
assert.equal(roundBy(2331 * 0.1, 'F'), 233); assert.equal(roundBy(2331 * 0.1, 'C'), 234);
assert.ok(Object.is(roundBy(-0.1, 'R'), 0)); assert.ok(Object.is(roundBy(-0.1, 'C'), 0)); assert.ok(Object.is(roundBy(0.2, 'F'), 0));
// 3) 이상값
assert.equal(roundBy(NaN, 'F'), 0); assert.equal(roundBy(Infinity, 'C'), 0);
// 4) 설정 정규화
assert.deepEqual(normalizeCalc(undefined), DEFAULT_CALC);
assert.deepEqual(normalizeCalc({ amt: 'F', vat: 'X' }), { amt: 'F', vat: 'R' });
assert.deepEqual(normalizeCalc(null), { amt: 'R', vat: 'R' });
console.log(`calcRules OK (R 동일성 ${n}건 + 경계값·내림·올림·정규화)`);
