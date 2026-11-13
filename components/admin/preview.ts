type Previewable = {id: string; url: string | null; file: string | null}

export const previewHref = ({id, url, file}: Previewable) => (url ? url : file ? `/api/resources/${id}/file` : null)
