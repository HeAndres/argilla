#  Copyright 2021-present, the Recognai S.L. team.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from typing_extensions import Self

from datasets import load_dataset
from sqlalchemy.ext.asyncio import AsyncSession

from argilla_server.models.database import Dataset
from argilla_server.search_engine import SearchEngine
from argilla_server.bulk.records_bulk import CreateRecordsBulk
from argilla_server.api.schemas.v1.records import RecordCreate as RecordCreateSchema
from argilla_server.api.schemas.v1.records_bulk import RecordsBulkCreate as RecordsBulkCreateSchema

BATCH_SIZE = 100


class HubDataset:
    # TODO: (Ben feedback) rename `name` to `repository_id` or `repo_id`
    # TODO: (Ben feedback) check subset and split and see if we should support None
    def __init__(self, name: str, subset: str, split: str):
        self.dataset = load_dataset(path=name, name=subset, split=split)
        self.iterable_dataset = self.dataset.to_iterable_dataset()

    @property
    def num_rows(self) -> int:
        return self.dataset.num_rows

    def take(self, n: int) -> Self:
        self.iterable_dataset = self.iterable_dataset.take(n)

        return self

    # TODO: We can change things so we get the database and search engine here instead of receiving them as parameters
    async def import_to(self, db: AsyncSession, search_engine: SearchEngine, dataset: Dataset) -> None:
        if not dataset.is_ready:
            raise Exception("it's not possible to import records to a non published dataset")

        batched_dataset = self.iterable_dataset.batch(batch_size=BATCH_SIZE)
        for batch in batched_dataset:
            await self._import_batch_to(db, search_engine, batch, dataset)

    async def _import_batch_to(
        self, db: AsyncSession, search_engine: SearchEngine, batch: dict, dataset: Dataset
    ) -> None:
        batch_size = len(next(iter(batch.values())))

        items = []
        for i in range(batch_size):
            # NOTE: if there is a value with key "id" in the batch, we will use it as external_id
            external_id = None
            if "id" in batch:
                external_id = batch["id"][i]

            fields = {}
            for field in dataset.fields:
                # TODO: Should we cast to string or change the schema to use not strict string?
                value = batch[field.name][i]
                if field.is_text:
                    value = str(value)

                fields[field.name] = value

            metadata = {}
            for metadata_property in dataset.metadata_properties:
                metadata[metadata_property.name] = batch[metadata_property.name][i]

            items.append(
                RecordCreateSchema(
                    fields=fields,
                    metadata=metadata,
                    external_id=external_id,
                    responses=None,
                    suggestions=None,
                    vectors=None,
                ),
            )

        await CreateRecordsBulk(db, search_engine).create_records_bulk(dataset, RecordsBulkCreateSchema(items=items))
