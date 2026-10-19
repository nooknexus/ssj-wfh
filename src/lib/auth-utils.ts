export interface UnauthorizedErrorLike {
  data?: {
    code?: string;
    httpStatus?: number;
  };
  shape?: {
    data?: {
      code?: string;
    };
    message?: string;
  };
  message?: string;
}

export const isUnauthorizedError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") {
    return false;
  }

  const error = err as UnauthorizedErrorLike;
  const isTrpcCode =
    error.data?.code === "UNAUTHORIZED" ||
    error.shape?.data?.code === "UNAUTHORIZED";
  const isStatus401 = error.data?.httpStatus === 401;
  const isMessageUnauthorized =
    error.message === "UNAUTHORIZED" ||
    error.message === "Invalid user session" ||
    error.message === "Invalid session" ||
    error.shape?.message === "UNAUTHORIZED";

  return Boolean(isTrpcCode || isStatus401 || isMessageUnauthorized);
};
