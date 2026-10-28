/** Admin view of a stored image: hidden/pending files are only served under /admin/files. */
export const adminSrc = (url: string) => (url.startsWith("/files/") ? `/admin${url}` : url);
