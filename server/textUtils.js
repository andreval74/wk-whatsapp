export function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function norm(s) {
  return stripAccents((s || '').toLowerCase());
}
