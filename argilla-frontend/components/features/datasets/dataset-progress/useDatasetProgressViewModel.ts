import { useResolve } from "ts-injecty";
import { GetDatasetProgressUseCase } from "@/v1/domain/usecases/get-dataset-progress-use-case";
import { Dataset } from "~/v1/domain/entities/dataset/Dataset";
import { useTranslate } from "~/v1/infrastructure/services/useTranslate";

export const useDatasetProgressViewModel = ({
  dataset,
}: {
  dataset: Dataset;
}) => {
  const getProgressUseCase = useResolve(GetDatasetProgressUseCase);

  const t = useTranslate();

  const { status, data: progress } = useLazyAsyncData(
    `progress-${dataset.id}`,
    () => getProgressUseCase.execute(dataset.id)
  );

  const progressRanges = computed(() => {
    return [
      {
        id: "submitted",
        name: t("datasets.submitted"),
        color: "#0508D9",
        value: progress.value.submitted,
        tooltip: `${progress.value.submitted}/${progress.value.total}`,
      },
      {
        id: "conflicting",
        name: t("datasets.conflicting"),
        color: "#8893c0",
        value: progress.value.conflicting,
        tooltip: `${progress.value.conflicting}/${progress.value.total}`,
      },
      {
        id: "discarded",
        name: t("datasets.discarded"),
        color: "#b7b7b7",
        value: progress.value.discarded,
        tooltip: `${progress.value.discarded}/${progress.value.total}`,
      },
      {
        id: "pending",
        name: t("datasets.left"),
        color: "#e6e6e6",
        value: progress.value.pending,
        tooltip: `${progress.value.pending}/${progress.value.total}`,
      },
    ];
  });

  const isLoaded = computed(() => {
    return status.value !== "idle" && status.value !== "pending";
  });

  return {
    isLoaded,
    progress,
    progressRanges,
  };
};
