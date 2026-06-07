import type { Game, ImportResult } from '../types/game';

const STORAGE_KEY = 'retro-game-collection';
const EXPORT_FILE_PREFIX = 'retro-game-backup';

export function loadGames(): Game[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load games from localStorage:', error);
  }
  return [];
}

export function saveGames(games: Game[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch (error) {
    console.error('Failed to save games to localStorage:', error);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface ExportData {
  version: string;
  exportedAt: number;
  count: number;
  games: Game[];
}

export function validateGame(game: any): game is Game {
  return (
    game &&
    typeof game.id === 'string' &&
    typeof game.name === 'string' &&
    typeof game.platform === 'string' &&
    typeof game.releaseYear === 'number' &&
    !isNaN(game.releaseYear) &&
    game.releaseYear >= 1970 &&
    game.releaseYear <= 2030 &&
    typeof game.publisher === 'string' &&
    typeof game.genre === 'string' &&
    typeof game.coverImage === 'string' &&
    ['none', 'playing', 'completed', 'wishlist'].includes(game.status) &&
    typeof game.romFileName === 'string' &&
    typeof game.createdAt === 'number' &&
    typeof game.updatedAt === 'number'
  );
}

export function exportGames(games: Game[]): void {
  const exportData: ExportData = {
    version: '1.0.0',
    exportedAt: Date.now(),
    count: games.length,
    games,
  };
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  link.download = `${EXPORT_FILE_PREFIX}-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importGames(file: File, existingGames: Game[]): Promise<ImportResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        message: '无效的文件格式',
        importedCount: 0,
        skippedCount: 0,
        totalCount: 0,
      };
    }

    if (!Array.isArray(data.games)) {
      return {
        success: false,
        message: '文件中没有游戏数据',
        importedCount: 0,
        skippedCount: 0,
        totalCount: 0,
      };
    }

    const validGames: Game[] = [];
    let invalidCount = 0;

    for (const game of data.games) {
      if (validateGame(game)) {
        validGames.push(game);
      } else {
        invalidCount++;
      }
    }

    const existingIds = new Set(existingGames.map((g) => g.id));
    const newGames = validGames.filter((g) => !existingIds.has(g.id));
    const duplicateCount = validGames.length - newGames.length;

    if (invalidCount > 0) {
      console.warn(`Skipped ${invalidCount} invalid game entries`);
    }

    return {
      success: true,
      message: `成功导入 ${newGames.length} 条游戏记录${duplicateCount > 0 ? `，跳过 ${duplicateCount} 条已存在的记录` : ''}${invalidCount > 0 ? `，忽略 ${invalidCount} 条无效数据` : ''}`,
      importedCount: newGames.length,
      skippedCount: duplicateCount + invalidCount,
      totalCount: data.games.length,
      games: newGames,
    };
  } catch (error) {
    let errorMessage = '导入失败';
    if (error instanceof SyntaxError) {
      errorMessage = '文件格式错误，不是有效的 JSON';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      success: false,
      message: errorMessage,
      importedCount: 0,
      skippedCount: 0,
      totalCount: 0,
    };
  }
}

