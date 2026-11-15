"""Versioned HTTP/tool schemas. Keep browser and model data behind the same validation."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

PROFILE_FIELDS = frozenset(('objective', 'horizon', 'riskTolerance', 'lossCapacity', 'liquidity', 'constraints', 'preferences', 'knowledge'))

class TabItem(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(max_length=80)
    title: str = Field(max_length=2000)
    status: Literal['pending', 'active', 'done', 'failed', 'skipped'] = 'pending'
    url: str | None = Field(default=None, max_length=1000)

class WorkspaceTab(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    title: str = Field(min_length=1, max_length=80)
    kind: Literal['profile', 'note', 'tasks', 'agents', 'sources', 'simulation', 'decision']
    content: str = Field(default='', max_length=64000)
    items: list[TabItem] = Field(default_factory=list, max_length=40)

    @model_validator(mode='after')
    def validate_content_size(self):
        if self.kind != 'simulation' and len(self.content) > 16000:
            raise ValueError('Le contenu de ce document dépasse 16 000 caractères.')
        return self


class AssistantPlanStep(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    title: str = Field(min_length=1, max_length=240)
    detail: str | None = Field(default=None, max_length=500)


class AssistantPlanInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=800)
    steps: list[AssistantPlanStep] = Field(min_length=3, max_length=6)

    @model_validator(mode='after')
    def validate_step_ids(self):
        if len({step.id for step in self.steps}) != len(self.steps):
            raise ValueError('Les identifiants des étapes doivent être uniques.')
        return self

class HistoryMessage(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(min_length=1, max_length=12000)

class QuestionOption(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    label: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=500)


class UserQuestion(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    label: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=800)
    kind: Literal['single_choice', 'multiple_choice', 'text']
    options: list[QuestionOption] = Field(default_factory=list, max_length=6)
    required: bool = True
    allowOther: bool = True
    placeholder: str | None = Field(default=None, max_length=300)

    @model_validator(mode='after')
    def validate_options(self):
        if self.kind == 'text' and self.options:
            raise ValueError('Une question ouverte ne contient pas de choix.')
        if self.kind != 'text' and len(self.options) < 2:
            raise ValueError('Une question à choix propose entre deux et six options.')
        if len({item.id for item in self.options}) != len(self.options):
            raise ValueError('Les identifiants des choix doivent être uniques.')
        return self


class AskUserInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=800)
    questions: list[UserQuestion] = Field(min_length=1, max_length=3)
    purpose: Literal['clarification', 'plan_approval'] = 'clarification'

    @model_validator(mode='after')
    def validate_questions(self):
        if len({item.id for item in self.questions}) != len(self.questions):
            raise ValueError('Les identifiants des questions doivent être uniques.')
        if self.purpose == 'plan_approval':
            if len(self.questions) != 1 or self.questions[0].kind != 'single_choice' or not self.questions[0].required:
                raise ValueError('La validation du plan attend une seule question obligatoire à choix unique.')
            labels = {option.label.casefold() for option in self.questions[0].options}
            if 'oui, lancer ce plan' not in labels or 'modifier le plan' not in labels:
                raise ValueError('La validation doit proposer « Oui, lancer ce plan » et « Modifier le plan ».')
        return self


class QuestionRequest(AskUserInput):
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')


class UserAnswer(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    questionId: str = Field(min_length=1, max_length=80)
    selectedOptionIds: list[str] = Field(default_factory=list, max_length=6)
    text: str = Field(default='', max_length=4000)


class QuestionAnswer(BaseModel):
    model_config = ConfigDict(extra='forbid')
    requestId: str = Field(min_length=1, max_length=80)
    answers: list[UserAnswer] = Field(max_length=3)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    message: str = Field(min_length=1, max_length=8000)
    workspaceMode: Literal['profiles','assistant'] = 'assistant'
    history: list[HistoryMessage] = Field(default_factory=list, max_length=30)
    profile: dict[str, str] = Field(default_factory=dict, max_length=8)
    tabs: list[WorkspaceTab] = Field(default_factory=list, max_length=12)
    accountId: Literal['amira', 'mateo', 'robert'] = 'mateo'
    questionRequest: QuestionRequest | None = None
    questionAnswer: QuestionAnswer | None = None

    @model_validator(mode='after')
    def validate_question_answer(self):
        request, answer = self.questionRequest, self.questionAnswer
        if bool(request) != bool(answer):
            raise ValueError('Joindre la demande de questions et ses réponses ensemble.')
        if request is None:
            return self
        if request.id != answer.requestId:
            raise ValueError('La réponse ne correspond pas à cette demande.')
        questions = {question.id: question for question in request.questions}
        supplied = {item.questionId: item for item in answer.answers}
        if len(supplied) != len(answer.answers) or not set(supplied) <= set(questions):
            raise ValueError('Identifiant de question inconnu ou répété.')
        for question_id, question in questions.items():
            item = supplied.get(question_id)
            if item is None:
                if question.required:
                    raise ValueError('Répondez aux questions obligatoires avant l’envoi.')
                continue
            selected = item.selectedOptionIds
            if len(set(selected)) != len(selected) or not set(selected) <= {option.id for option in question.options}:
                raise ValueError('Choix inconnu ou répété.')
            if question.kind == 'text' and selected:
                raise ValueError('Une réponse développée ne contient pas de choix.')
            if question.kind == 'single_choice' and len(selected) > 1:
                raise ValueError('Cette question attend un seul choix.')
            if question.kind != 'text' and item.text and not question.allowOther:
                raise ValueError('La réponse libre n’est pas proposée pour cette question.')
            if question.required and not selected and not item.text:
                raise ValueError('Répondez aux questions obligatoires avant l’envoi.')
        return self


class PositionShock(BaseModel):
    model_config = ConfigDict(extra='forbid')
    positionId: str = Field(min_length=1, max_length=100)
    shockPct: float = Field(ge=-100, le=200)


class ScenarioAnalysisInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    shocks: list[PositionShock] = Field(min_length=1, max_length=20)

    @model_validator(mode='after')
    def validate_positions_are_unique(self):
        ids = [shock.positionId for shock in self.shocks]
        if len(set(ids)) != len(ids):
            raise ValueError('Chaque position doit apparaître une seule fois.')
        return self


class SimulationHistoryInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    ticker: str = Field(min_length=1, max_length=16, pattern=r'^[A-Za-z0-9.-]+$')
    startDate: date | None = None
    endDate: date | None = None

    @model_validator(mode='after')
    def validate_period(self):
        if self.startDate and self.endDate and self.startDate > self.endDate:
            raise ValueError('La date de début doit précéder la date de fin.')
        return self
