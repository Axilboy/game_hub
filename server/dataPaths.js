import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Единая папка для персистентных данных (статистика, обратная связь).
 * На Railway/Docker смонтируйте volume и задайте GAMEHUB_DATA_DIR=/path/to/data
 * — иначе при каждом деплое контейнер обнуляется и файлы теряются.
 */
export function getGameHubDataDir() {
  if (process.env.GAMEHUB_DATA_DIR) {
    return resolve(process.env.GAMEHUB_DATA_DIR);
  }
  return join(__dirname, '..', 'data');
}
