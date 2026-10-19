export const isManualLocationAllowed = (settingValue?: string | null): boolean => {
  if (settingValue === undefined || settingValue === null) {
    return true;
  }
  return settingValue.toLowerCase() !== "false";
};
