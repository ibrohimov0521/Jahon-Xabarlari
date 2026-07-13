"use client";

import { useEffect } from "react";
import { recordArticleView } from "../lib/api";

export function ArticleViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    void recordArticleView(articleId);
  }, [articleId]);
  return null;
}
