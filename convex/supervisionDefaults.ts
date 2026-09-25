export const DEFAULT_DEPUTY_NAME = "ابوذر فضل الله العبيد";
export const deputyNameOf = (settings: { deputyName?: string } | null | undefined) => settings?.deputyName?.trim() || DEFAULT_DEPUTY_NAME;
