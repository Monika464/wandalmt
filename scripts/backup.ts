
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { promisify } from "util";
import cron from "node-cron";

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const BACKUP_DIR = path.join(__dirname, "..", "backups");
const MAX_BACKUPS = 7;

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("❌ Brak MONGODB_URI w .env");
  process.exit(1);
}

mongoUri = mongoUri.replace(/^"|"$/g, "");

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function deleteOldBackups(): void {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files
      .filter(
        (f) =>
          f.startsWith("backup-") &&
          fs.statSync(path.join(BACKUP_DIR, f)).isDirectory()
      )
      .sort()
      .reverse();

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach((file) => {
        const filePath = path.join(BACKUP_DIR, file);
        fs.rmSync(filePath, { recursive: true, force: true });
        log(`🗑️ Usunięto: ${file}`);
      });
    }
  } catch (err: any) {
    console.error("Błąd usuwania:", err.message);
  }
}

function calculateSize(dir: string): number {
  let totalSize = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      totalSize += calculateSize(filePath);
    } else {
      totalSize += stat.size;
    }
  }
  return totalSize;
}

async function backupDatabase(): Promise<void> {
  const date = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const backupPath = path.join(BACKUP_DIR, `backup-${date}`);

  log(`🔄 Backup bazy...`);
  const startTime = Date.now();

  try {
    await execPromise(`mongodump --uri="${mongoUri}" --out="${backupPath}"`);

    if (!fs.existsSync(backupPath)) {
      throw new Error("Backup folder not created");
    }

    const totalSize = calculateSize(backupPath);
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`✅ Backup zakończony w ${duration}s`);
    log(`💾 Rozmiar: ${sizeInMB} MB`);

    deleteOldBackups();
  } catch (error: any) {
    if (fs.existsSync(backupPath) && fs.readdirSync(backupPath).length > 0) {
      log(`✅ Backup zakończony (mimo ostrzeżeń)`);
      deleteOldBackups();
    } else {
      log(`❌ Backup nieudany: ${error.message}`);
    }
  }
}

// Konfiguracja CRON - codziennie o 2:00
cron.schedule('0 2 * * *', () => {
  log('🕐 Rozpoczynam zaplanowany backup...');
  backupDatabase();
});

console.log('\n═══════════════════════════════════════════════');
console.log('🛡️ MongoDB Backup System Started (TypeScript)');
console.log('═══════════════════════════════════════════════');
console.log(`📁 Backup directory: ${BACKUP_DIR}`);
console.log(`💾 Keeping last ${MAX_BACKUPS} backups`);
console.log(`⏰ Schedule: Daily at 2:00 AM`);
console.log('═══════════════════════════════════════════════\n');

// Wykonaj backup testowy przy starcie
log('🧪 Backup testowy...');
backupDatabase();
