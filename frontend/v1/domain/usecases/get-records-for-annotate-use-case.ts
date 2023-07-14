import type { NuxtAxiosInstance } from "@nuxtjs/axios";
import { Field } from "../entities/Field";
import { Question } from "../entities/question/Question";
import { Record } from "../entities/record/Record";
import { Suggestion } from "../entities/question/Suggestion";
import { IRecordStorage } from "../services/IRecordStorage";
import { Records } from "../entities/record/Records";
import { RecordAnswer } from "../entities/record/RecordAnswer";
import {
  RecordRepository,
  QuestionRepository,
  FieldRepository,
} from "@/v1/infrastructure/repositories";

export class GetRecordsForAnnotateUseCase {
  private readonly recordRepository: RecordRepository;
  private readonly questionRepository: QuestionRepository;
  private readonly fieldRepository: FieldRepository;
  constructor(
    axios: NuxtAxiosInstance,
    private readonly recordsStorage: IRecordStorage
  ) {
    this.recordRepository = new RecordRepository(axios);
    this.questionRepository = new QuestionRepository(axios);
    this.fieldRepository = new FieldRepository(axios);
  }

  async execute(
    datasetId: string,
    offset: number,
    status: string,
    searchText: string
  ): Promise<Records> {
    const getRecords = this.recordRepository.getRecords(
      datasetId,
      offset,
      status,
      searchText
    );
    const getQuestions = this.questionRepository.getQuestions(datasetId);
    const getFields = this.fieldRepository.getFields(datasetId);

    const [recordsFromBackend, questionsFromBackend, fieldsFromBackend] =
      await Promise.all([getRecords, getQuestions, getFields]);

    const recordsToAnnotate = recordsFromBackend.records.map((record) => {
      const fields = Object.keys(record.fields).map((fieldName) => {
        const field = fieldsFromBackend.find(
          (field) => field.name === fieldName
        );

        return new Field(
          field.id,
          field.title,
          record.fields[fieldName],
          datasetId,
          field.required,
          field.settings
        );
      });

      const questions = questionsFromBackend.map((question) => {
        return new Question(
          question.id,
          question.name,
          question.description,
          datasetId,
          question.title,
          question.required,
          question.settings
        );
      });

      const userAnswer = record.responses[0];
      const answer = userAnswer
        ? new RecordAnswer(userAnswer.id, userAnswer.status, userAnswer.values)
        : null;

      const suggestions = record.suggestions.map((suggestion) => {
        return new Suggestion(
          suggestion.id,
          suggestion.question_id,
          suggestion.value
        );
      });

      return new Record(
        record.id,
        datasetId,
        questions,
        fields,
        answer,
        suggestions
      );
    });

    const records = new Records(recordsToAnnotate, recordsFromBackend.total);

    this.recordsStorage.add(records);

    return records;
  }
}
