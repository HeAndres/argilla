import { type NuxtAxiosInstance } from "@nuxtjs/axios";
import {
  BackedRecord,
  BackedRecords,
  BackendAnswerCombinations,
  BackendResponse,
  BackendResponseStatus,
  Response,
} from "../types";
import { RecordAnswer } from "@/v1/domain/entities/record/RecordAnswer";
import { Record } from "@/v1/domain/entities/record/Record";
import { Question } from "@/v1/domain/entities/question/Question";

const RECORD_API_ERRORS = {
  ERROR_FETCHING_RECORDS: "ERROR_FETCHING_RECORDS",
  ERROR_DELETING_RECORD_RESPONSE: "ERROR_DELETING_RECORD_RESPONSE",
  ERROR_UPDATING_RECORD_RESPONSE: "ERROR_UPDATING_RECORD_RESPONSE",
  ERROR_CREATING_RECORD_RESPONSE: "ERROR_CREATING_RECORD_RESPONSE",
};

export class RecordRepository {
  constructor(private readonly axios: NuxtAxiosInstance) {}

  getRecords(
    datasetId: string,
    offset: number,
    status: string,
    searchText: string,
    numberOfRecordsToFetch = 10
  ): Promise<BackedRecords> {
    if (searchText && searchText.length)
      return this.getRecordsByText(
        datasetId,
        offset,
        status,
        searchText,
        numberOfRecordsToFetch
      );

    return this.getRecordsDatasetId(
      datasetId,
      offset,
      status,
      numberOfRecordsToFetch
    );
  }

  async deleteRecordResponse(answer: RecordAnswer) {
    try {
      await this.axios.delete(`/v1/responses/${answer.id}`);
    } catch (error) {
      throw {
        response: RECORD_API_ERRORS.ERROR_DELETING_RECORD_RESPONSE,
      };
    }
  }

  async discardRecordResponse(record: Record) {
    try {
      const request = this.createRequest("discarded", record.questions);

      return await this.axios.put(`/v1/responses/${record.answer.id}`, request);
    } catch (error) {
      throw {
        response: RECORD_API_ERRORS.ERROR_UPDATING_RECORD_RESPONSE,
      };
    }
  }

  async submitNewRecordResponse(record: Record): Promise<BackendResponse> {
    try {
      const request = this.createRequest("submitted", record.questions);

      const response = await this.axios.post<BackendResponse>(
        `/v1/records/${record.id}/responses`,
        request
      );

      return response.data;
    } catch (error) {
      throw {
        response: RECORD_API_ERRORS.ERROR_CREATING_RECORD_RESPONSE,
      };
    }
  }

  private async getRecordsDatasetId(
    datasetId: string,
    offset: number,
    status: string,
    numberOfRecordsToFetch: number
  ): Promise<BackedRecords> {
    try {
      const url = `/v1/me/datasets/${datasetId}/records`;

      const params = this.createParams(offset, numberOfRecordsToFetch, status);

      const { data } = await this.axios.get<Response<BackedRecord[]>>(url, {
        params,
      });

      return {
        records: data.items,
        total: data.items.length,
      };
    } catch (err) {
      throw {
        response: RECORD_API_ERRORS.ERROR_FETCHING_RECORDS,
      };
    }
  }

  private async getRecordsByText(
    datasetId: string,
    offset: number,
    status: string,
    searchText: string,
    numberOfRecordsToFetch: number
  ): Promise<BackedRecords> {
    try {
      const url = `/v1/me/datasets/${datasetId}/records/search`;

      const body = JSON.parse(
        JSON.stringify({
          query: {
            text: {
              q: searchText,
            },
          },
        })
      );

      const params = this.createParams(offset, numberOfRecordsToFetch, status);

      const { data } = await this.axios.post(url, body, { params });

      const { items, total: totalRecords } = data;

      const records = items.map((item) => item.record);

      return {
        records,
        total: totalRecords,
      };
    } catch (err) {
      throw {
        response: RECORD_API_ERRORS.ERROR_FETCHING_RECORDS,
      };
    }
  }

  private createRequest(
    status: BackendResponseStatus,
    questions: Question[]
  ): Omit<BackendResponse, "id"> {
    const values = {} as BackendAnswerCombinations;

    questions.forEach((question) => {
      if (question.answer.isValid)
        values[question.name] = { value: question.answer.valuesAnswered };
    });

    return {
      status,
      values,
    };
  }

  private createParams(
    offset: number,
    numberOfRecordsToFetch: number,
    status: string
  ) {
    const params = new URLSearchParams();
    params.append("include", "responses");
    params.append("include", "suggestions");
    params.append("offset", offset.toString());
    params.append("limit", numberOfRecordsToFetch.toString());
    params.append("response_status", status);

    return params;
  }
}
