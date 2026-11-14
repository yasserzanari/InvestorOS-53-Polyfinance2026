/** Versioned contract shared with profiles/models.py on the API. */
export type AskUserQuestion = {
  id: string;
  label: string;
  description?: string;
  kind: 'single_choice' | 'multiple_choice' | 'text';
  options: {id: string; label: string; description?: string}[];
  required: boolean;
  allowOther: boolean;
  placeholder?: string;
};
export type AskUserRequest = {id: string; title: string; description?: string; questions: AskUserQuestion[]};
export type AskUserAnswer = {requestId: string; answers: {questionId: string; selectedOptionIds: string[]; text: string}[]};

export function formatQuestionAnswer(request: AskUserRequest, answer: AskUserAnswer): string {
  return request.questions.map(question => {
    const value = answer.answers.find(item => item.questionId === question.id);
    const labels = question.options.filter(option => value?.selectedOptionIds.includes(option.id)).map(option => option.label);
    if (value?.text.trim()) labels.push(value.text.trim());
    return `${question.label}\n${labels.join(' ; ') || 'Je préfère préciser plus tard.'}`;
  }).join('\n\n').slice(0, 7900);
}
