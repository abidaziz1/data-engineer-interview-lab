import test from 'node:test';
import assert from 'node:assert/strict';
import { modules, lessons, days } from '../src/content/curriculum.js';
import { questions, mockSets } from '../src/content/questions.js';
import { challenges } from '../src/content/coding.js';
import { decisions } from '../src/content/decisions.js';

test('all ten chapters contain substantial explain / implement / defend content', () => {
  assert.equal(modules.length, 10); assert.equal(lessons.length, 68);
  for (const m of modules) { assert.ok(m.lessons.length >= 6); assert.ok(m.outcome); }
  for (const l of lessons) {
    for (const field of ['id', 'title', 'tech', 'phase', 'explain', 'why', 'answer', 'deep', 'trap']) assert.ok(l[field]?.length > 1, `${l.id}: ${field}`);
    assert.ok(l.explain.length >= 120, `${l.id}: substantive explanation`);
    assert.ok(l.answer.length >= 200, `${l.id}: meaningful interview answer`);
    assert.ok(l.steps.length >= 4, `${l.id}: complete visual trace`);
  }
});
test('all identifiers are unique and all lesson questions point to real scenes', () => {
  for (const collection of [modules, lessons, questions, challenges, decisions]) assert.equal(new Set(collection.map(x => x.id)).size, collection.length);
  for (const q of questions) {
    assert.ok(q.prompt && q.answer && q.deep && q.pitfall && q.followup, q.id);
    assert.ok(q.criteria.length >= 3, q.id);
    assert.ok(modules.some(m => m.id === q.topic), q.id);
    if (q.lessonId) assert.ok(lessons.some(l => l.id === q.lessonId), q.id);
  }
});
test('five-day plan covers each chapter exactly once', () => {
  assert.equal(days.length, 5);
  const planned = days.flatMap(d => d.modules);
  assert.deepEqual([...planned].sort(), modules.map(m => m.id).sort());
  assert.equal(new Set(planned).size, planned.length);
});
test('each mock has twelve distinct questions with valid references', () => {
  for (const ids of Object.values(mockSets)) {
    assert.equal(ids.length, 12); assert.equal(new Set(ids).size, 12);
    for (const id of ids) assert.ok(questions.some(q => q.id === id), id);
  }
});
test('coding examples have consistent table shapes, hints, and valid highlighted lines', () => {
  assert.equal(challenges.length, 16);
  for (const c of challenges) {
    assert.ok(c.hints.length >= 2, c.id);
    assert.ok(c.edges.length >= 2, c.id);
    assert.ok(c.walkthrough.length >= 3, c.id);
    for (const fixture of [c.input, c.expected]) for (const row of fixture.rows) assert.equal(row.length, fixture.columns.length, c.id);
    const lines = c.solution.split('\n').length;
    for (const part of c.walkthrough) for (const line of part.lines) assert.ok(line >= 1 && line <= lines, `${c.id}: line ${line} / ${lines}`);
  }
});
test('every architecture choice explains alternatives and the changing requirements', () => {
  for (const d of decisions) {
    assert.equal(d.options.filter(x => x.preferred).length, 1, d.id);
    assert.ok(d.tradeoff.length > 50, d.id);
    for (const option of d.options) assert.ok(option.result.trim(), d.id);
  }
});
test('the crash route includes every chapter and reaches a final scene', () => {
  const essential = lessons.filter(l => l.essential);
  for (const m of modules) assert.ok(essential.some(l => l.moduleId === m.id), m.id);
  assert.equal(essential[0].id, 'story-intro');
  assert.ok(essential.length < lessons.length);
});
