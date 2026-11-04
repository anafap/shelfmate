export type ListPage<T> = { items: T[]; total: number; page: number; pageSize: number };

export function nextPage(page: ListPage<unknown>) {
  return page.page * page.pageSize < page.total ? page.page + 1 : undefined;
}

export function uniquePageItems<T extends { id: string }>(pages?: ListPage<T>[]) {
  return pages ? [...new Map(pages.flatMap(page => page.items).map(item => [item.id, item])).values()] : undefined;
}
