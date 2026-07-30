import { Prisma } from "@prisma/client";

type SearchLanguage = "uz" | "ru" | "en";

export function buildPublicArticleSearchWhere({
  q,
  lang,
  categoryId,
  categorySlug
}: {
  q: string;
  lang?: SearchLanguage;
  categoryId?: string;
  categorySlug?: string;
}): Prisma.ArticleWhereInput {
  const and: Prisma.ArticleWhereInput[] = [];

  if (categoryId) {
    and.push({ OR: [{ categoryId }, { extraCategoryIds: { has: categoryId } }] });
  } else if (categorySlug) {
    and.push({ category: { slug: categorySlug } });
  }

  if (q) {
    const originalSearch: Prisma.ArticleWhereInput[] = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } }
    ];
    const translatedSearch: Prisma.ArticleWhereInput[] =
      lang && lang !== "uz"
        ? [{
            translations: {
              some: {
                lang,
                status: "READY",
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { summary: { contains: q, mode: "insensitive" } },
                  { content: { contains: q, mode: "insensitive" } }
                ]
              }
            }
          }]
        : [];

    and.push({ OR: [...originalSearch, ...translatedSearch] });
  }

  return {
    deletedAt: null,
    status: "PUBLISHED",
    ...(and.length ? { AND: and } : {})
  };
}
