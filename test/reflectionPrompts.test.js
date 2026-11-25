import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFLECTION_PROMPTS, reflectionPrompts } from '../src/reflectionPrompts.js';

test('uses the default prompts for neutral or empty answers', () => {
  assert.deepEqual(reflectionPrompts(''), REFLECTION_PROMPTS);
  assert.deepEqual(reflectionPrompts('Went to the office'), REFLECTION_PROMPTS);
});

test('adapts the second prompt to difficult or positive first answers', () => {
  assert.equal(reflectionPrompts('A rough, stressful meeting')[1].kicker, 'Be gentle with yourself');
  assert.equal(reflectionPrompts('Felt grateful for lunch')[1].kicker, 'Savor the good');
  assert.equal(reflectionPrompts('Good but exhausting')[1].kicker, 'Be gentle with yourself');
});

test('only changes the second prompt', () => {
  const prompts = reflectionPrompts('so tired');
  assert.equal(prompts[0], REFLECTION_PROMPTS[0]);
  assert.equal(prompts[2], REFLECTION_PROMPTS[2]);
});
