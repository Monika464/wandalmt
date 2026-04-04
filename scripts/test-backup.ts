//cat > (scripts / test - backup.ts) << "EOF";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path/win32";

dotenv.config();

const execPromise = promisify(exec);

async function testBackup() {
  console.log("🔍 Sprawdzanie konfiguracji...");

  // 1. Sprawdź MONGODB_URI
  const mongoUri = process.env.MONGODB_URI;
  console.log(`   MONGODB_URI: ${mongoUri ? mongoUri : "❌ BRAK"}`);
  if (!mongoUri) {
    console.error("❌ Brak MONGODB_URI w pliku .env");
    console.log("📝 Dodaj do .env: MONGODB_URI=mongodb+srv://...");
    return;
  }
  console.log("✅ MONGODB_URI istnieje");

  // 2. Sprawdź czy mongodump istnieje
  try {
    const { stdout } = await execPromise("mongodump --version");
    console.log("✅ mongodump dostępny");
    console.log(`   Wersja: ${stdout.split("\n")[0]}`);
  } catch (error) {
    console.error("❌ mongodump nie jest zainstalowany!");
    console.log("📥 Zainstaluj MongoDB Database Tools:");
    console.log("   https://www.mongodb.com/try/download/database-tools");
    return;
  }

  // 3. Próbuj wykonać backup
  console.log("\n🔄 Próba backupu...");
  const date = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const backupPath = `./test-backup-${date}`;

  try {
    const { stdout, stderr } = await execPromise(
      `mongodump --uri="${mongoUri}" --out="${backupPath}" --collection=videos --limit=1`,
    );

    console.log("✅ Backup testowy udany!");
    console.log(`   Lokalizacja: ${backupPath}`);
    if (stderr) console.log(`   Info: ${stderr}`);
  } catch (error: any) {
    console.error("❌ Backup failed:", error.message);
    if (error.stderr) console.error("Details:", error.stderr);
  }
}

testBackup();
