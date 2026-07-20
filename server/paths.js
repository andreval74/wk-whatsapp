import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH_ROOT = path.join(__dirname, 'auth');
export const DATA_DIR = path.join(__dirname, '..', 'data');
