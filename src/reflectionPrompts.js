export const REFLECTION_PROMPTS = [
  { kicker: 'Look back', title: 'What stood out today?', hint: 'Something big, or a small moment you want to remember.' },
  { kicker: 'Stay with it', title: 'What did that moment bring up for you?', hint: 'Notice what you felt, what mattered, or what you learned.' },
  { kicker: 'Look ahead', title: 'What do you want to carry into tomorrow?', hint: 'A thought, a feeling, or one small thing to make space for.' },
];

const DIFFICULT = /\b(stress|hard|difficult|overwhelm|anxious|anxiety|sad|tired|exhaust|frustrat|worr|afraid|lonely|angry|upset|rough|struggl)\w*/i;
const POSITIVE = /\b(happy|joy|good|love|laugh|proud|grateful|excit|peace|calm|beautiful|kind|great|wonderful)\w*/i;

export function reflectionPrompts(firstAnswer = '') {
  const prompts = [...REFLECTION_PROMPTS];
  if (DIFFICULT.test(firstAnswer)) {
    prompts[1] = { kicker: 'Be gentle with yourself', title: 'What made that moment difficult, and what helped you through it?', hint: 'You can name the hard part without needing to solve it now.' };
  } else if (POSITIVE.test(firstAnswer)) {
    prompts[1] = { kicker: 'Savor the good', title: 'What made that moment feel meaningful?', hint: 'Take a little time to notice what made it matter.' };
  }
  return prompts;
}
