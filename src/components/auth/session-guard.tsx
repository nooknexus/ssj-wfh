"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const REDIRECT_TARGET = "/login";

export const SessionGuard = () => {
  const { data: session, status } = useSession();
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    if (isRedirectingRef.current) {
      return;
    }

    const isUnauthenticated = status === "unauthenticated";
    const hasMissingUserId = status === "authenticated" && !session?.user?.id;

    if (isUnauthenticated || hasMissingUserId) {
      isRedirectingRef.current = true;
      window.location.href = REDIRECT_TARGET;
    }
  }, [session, status]);

  return null;
};
