import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const legacyPath = path.resolve(process.cwd(), '../오케이세일/Data');
    let files: Array<{ name: string; size: number; modified: string; type: string }> = [];

    if (fs.existsSync(legacyPath)) {
      const dirEntries = fs.readdirSync(legacyPath, { withFileTypes: true });
      files = dirEntries.map(entry => {
        const fullPath = path.join(legacyPath, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          return {
            name: entry.name,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            type: entry.isDirectory() ? 'directory' : path.extname(entry.name).toLowerCase()
          };
        } catch {
          return {
            name: entry.name,
            size: 0,
            modified: new Date().toISOString(),
            type: 'unknown'
          };
        }
      });
    }

    return NextResponse.json({
      legacyPath,
      exists: fs.existsSync(legacyPath),
      totalFiles: files.length,
      files
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'MDB 분석 실패' }, { status: 500 });
  }
}
