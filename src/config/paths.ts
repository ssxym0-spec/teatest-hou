import path from 'path';

export const PROJECT_ROOT = process.cwd();
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
export const VIEWS_DIR = path.join(PROJECT_ROOT, 'views');
export const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

