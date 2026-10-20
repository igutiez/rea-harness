import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const docs = {
  README: readFileSync(join(ROOT, 'README.md'), 'utf8'),
};

test('the public surface sends humans and chat agents through canonical onboarding', () => {
  assert.match(docs.README, /github:igutiez\/rea-harness/, 'README lacks the canonical onboarding command');
  assert.match(docs.README, /technical-level/, 'README does not expose the first wizard answer');
  assert.match(docs.README, /accept-plan/, 'README does not explain binding acceptance');
  assert.match(docs.README, /--with-rea/, 'README does not name the REA consent flag');
});

test('the public claim states the guarantee boundary and no longer promises a profile menu', () => {
  assert.match(docs.README, /writes nothing|no escribe nada/i);
  assert.doesNotMatch(docs.README, /asks which package and assistant|pregunta qué paquete y asistente/i);
  assert.doesNotMatch(docs.README, /--profile\s+(minimal|core|full)/i);
});

test('agent copy says to relay questions and never invent onboarding answers', () => {
  assert.match(docs.README, /relay|pregunta/i);
  assert.match(docs.README, /never (?:choose|invent|default)|nunca (?:elijas|inventes)/i);
  assert.match(docs.README, /project root|raíz del proyecto/i);
});

test('the REA claim is opt-in and evidence-backed', () => {
  assert.match(docs.README, /REA/);
  assert.match(docs.README, /Evidence ID|evidencia/i);
  assert.match(docs.README, /user-level|configuración de usuario/i);
  assert.doesNotMatch(docs.README, /installs REA automatically|instala REA automáticamente/i);
});
